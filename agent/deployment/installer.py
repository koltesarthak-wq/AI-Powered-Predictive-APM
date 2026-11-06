"""Build a configured Windows setup EXE using a locally installed Inno compiler."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
from datetime import datetime, timezone
from urllib.parse import urlsplit


BUILD_LOCK = threading.Lock()
EXE_NAME = "AI-Predictive-APM-Agent.exe"


class InstallerBuildError(RuntimeError):
    pass


def validate_url(value):
    value = value.strip().rstrip("/")
    try:
        parsed = urlsplit(value)
        _ = parsed.port
    except ValueError as error:
        raise ValueError("Enter a valid backend URL, including its port if needed.") from error
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or any(character.isspace() or ord(character) < 32 for character in value)):
        raise ValueError("Use an http:// or https:// backend address without credentials, a query, or a fragment.")
    return value


def validate_id(value):
    if not re.fullmatch(r"[0-9a-f]{32}", value):
        raise ValueError("Invalid deployment ID.")
    return value


def find_compiler(project_root):
    candidates = [os.environ.get("APM_ISCC_PATH"), shutil.which("ISCC.exe"),
                  str(project_root / "tools" / "inno" / "ISCC.exe")]
    for base in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)"),
                 str(Path(os.environ.get("LOCALAPPDATA", "")) / "Programs")):
        if base:
            candidates.extend(str(Path(base) / name / "ISCC.exe")
                              for name in ("Inno Setup 7", "Inno Setup 6"))
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate).resolve()
    raise InstallerBuildError("Windows installer compiler is unavailable. Install Inno Setup on the backend host or set APM_ISCC_PATH to ISCC.exe.")


def build_installer(project_root, deployment_id, agent_name, operating_system,
                    backend_url, collection_interval):
    project_root = Path(project_root).resolve()
    validate_id(deployment_id)
    if operating_system.lower() != "windows":
        raise ValueError("The installer currently supports Windows x64 only.")
    backend_url = validate_url(backend_url)
    if not 1 <= collection_interval <= 3600:
        raise ValueError("Collection interval must be between 1 and 3600 seconds.")
    compiler = find_compiler(project_root)
    deployment_root = project_root / "agent" / "deployment"
    runtime = deployment_root / "release" / "runtime"
    if not (runtime / EXE_NAME).is_file() or not (runtime / "_internal").is_dir():
        raise InstallerBuildError("Agent runtime is missing. Run agent/deployment/build-agent.ps1 on the backend host first.")

    directory = deployment_root / "generated" / deployment_id
    directory.mkdir(parents=True, exist_ok=False)
    config = dict(agent_name=agent_name, backend_url=backend_url,
                  collection_interval=collection_interval, api_key="",
                  enable_cpu=True, enable_memory=True, enable_disk=True,
                  enable_network=True, enable_process=True)
    (directory / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    (directory / "connection.txt").write_text(
        f"Predictive APM Host Agent\n\nAgent: {agent_name}\nBackend: {backend_url}\n"
        f"Collection interval: {collection_interval} seconds\n\n"
        "Setup installs a Windows service that starts now and after Windows starts, even before sign-in.\n"
        "The agent sends host CPU, memory, disk and process readings to the backend shown above. "
        "Your APM website reads those readings from that backend.\n\n"
        "The backend must be reachable from this host. localhost and 127.0.0.1 work only when "
        "the backend runs on this same computer. If the backend is offline, the agent keeps retrying.\n\n"
        "Remove the agent later through Windows Settings > Apps > Installed apps.\n",
        encoding="utf-8-sig")
    filename = f"Predictive-APM-Agent-Setup-{deployment_id[:8]}.exe"
    command = [str(compiler), "/Q", f"/DRuntimeDir={runtime}",
               f"/DDeploymentDir={directory}", f"/O{directory}", f"/F{Path(filename).stem}",
               str(deployment_root / "windows-agent.iss")]
    try:
        # Bound memory usage when several users request installers simultaneously.
        with BUILD_LOCK:
            result = subprocess.run(command, capture_output=True, text=True, timeout=180,
                                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if result.returncode != 0:
            raise InstallerBuildError("Installer compilation failed. See the deployment build.log on the backend host.")
    except subprocess.TimeoutExpired as error:
        raise InstallerBuildError("Installer compilation timed out. Try again or check the backend host.") from error
    finally:
        if "result" in locals():
            (directory / "build.log").write_text(result.stdout + result.stderr, encoding="utf-8")
    output = directory / filename
    if not output.is_file():
        raise InstallerBuildError("The compiler did not produce a setup EXE.")
    with output.open("rb") as file:
        digest = hashlib.file_digest(file, "sha256").hexdigest()
    metadata = dict(deployment_id=deployment_id, agent_name=agent_name,
                    operating_system="Windows", architecture="x64", backend_url=backend_url,
                    collection_interval=collection_interval, status="INSTALLER_READY",
                    package=filename, package_type="exe", size_bytes=output.stat().st_size,
                    sha256=digest,
                    created_at=datetime.now(timezone.utc).isoformat(),
                    download_endpoint=f"/agent/deployment/download/{deployment_id}")
    (directory / "deployment.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def load_deployment(project_root, deployment_id):
    validate_id(deployment_id)
    directory = Path(project_root) / "agent" / "deployment" / "generated" / deployment_id
    try:
        metadata = json.loads((directory / "deployment.json").read_text(encoding="utf-8"))
        filename = metadata["package"]
        if Path(filename).name != filename or not filename.endswith(".exe"):
            return None
        if not (directory / filename).is_file():
            return None
        return metadata
    except (FileNotFoundError, ValueError, KeyError):
        return None
