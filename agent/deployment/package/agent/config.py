import json
import sys
from pathlib import Path


# ============================================================
# CONFIGURATION DIRECTORY
# ============================================================

if getattr(sys, "frozen", False):

    # PyInstaller EXE
    # config.json must be beside the installed EXE
    BASE_DIR = Path(
        sys.executable
    ).resolve().parent

else:

    # Normal Python execution
    BASE_DIR = Path(
        __file__
    ).resolve().parent


CONFIG_FILE = BASE_DIR / "config.json"


# ============================================================
# DEFAULT CONFIGURATION
# ============================================================

DEFAULT_CONFIG = {
    "agent_name": "AI-Predictive-APM-Agent",
    "backend_url": "http://127.0.0.1:8001",
    "api_key": "",
    "collection_interval": 5,
    "enable_cpu": True,
    "enable_memory": True,
    "enable_disk": True,
    "enable_network": True,
    "enable_process": True
}


# ============================================================
# LOAD CONFIGURATION
# ============================================================

def load_config():

    if not CONFIG_FILE.exists():

        try:

            save_config(
                DEFAULT_CONFIG
            )

        except Exception:
            pass

        return DEFAULT_CONFIG.copy()

    try:

        with open(
            CONFIG_FILE,
            "r",
            encoding="utf-8-sig"
        ) as file:

            config = json.load(file)

        for key, value in DEFAULT_CONFIG.items():

            if key not in config:

                config[key] = value

        return config

    except Exception as error:

        print(
            f"[CONFIG] Error loading configuration: {error}"
        )

        print(
            "[CONFIG] Using default configuration"
        )

        return DEFAULT_CONFIG.copy()


# ============================================================
# SAVE CONFIGURATION
# ============================================================

def save_config(config):

    try:

        BASE_DIR.mkdir(
            parents=True,
            exist_ok=True
        )

        with open(
            CONFIG_FILE,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                config,
                file,
                indent=4
            )

        return True

    except Exception as error:

        print(
            f"[CONFIG] Error saving configuration: {error}"
        )

        return False


# ============================================================
# LOAD CONFIG
# ============================================================

CONFIG = load_config()


# ============================================================
# AGENT SETTINGS
# ============================================================

AGENT_NAME = CONFIG.get(
    "agent_name",
    DEFAULT_CONFIG["agent_name"]
)

BACKEND_URL = CONFIG.get(
    "backend_url",
    DEFAULT_CONFIG["backend_url"]
)

API_KEY = CONFIG.get(
    "api_key",
    DEFAULT_CONFIG["api_key"]
)

INTERVAL_SECONDS = CONFIG.get(
    "collection_interval",
    DEFAULT_CONFIG["collection_interval"]
)

METRICS_ENDPOINT = (
    BACKEND_URL.rstrip("/")
    + "/agent/metrics"
)

HEARTBEAT_ENDPOINT = (
    BACKEND_URL.rstrip("/")
    + "/agent/heartbeat"
)


# ============================================================
# MONITORING FLAGS
# ============================================================

ENABLE_CPU = CONFIG.get(
    "enable_cpu",
    True
)

ENABLE_MEMORY = CONFIG.get(
    "enable_memory",
    True
)

ENABLE_DISK = CONFIG.get(
    "enable_disk",
    True
)

ENABLE_NETWORK = CONFIG.get(
    "enable_network",
    True
)

ENABLE_PROCESS = CONFIG.get(
    "enable_process",
    True
)


# ============================================================
# CONFIGURATION DISPLAY
# ============================================================

if __name__ == "__main__":

    print()
    print("==============================================")
    print("      AI PREDICTIVE APM AGENT CONFIG")
    print("==============================================")

    print(
        f"Config file: {CONFIG_FILE}"
    )

    print(
        f"Agent Name: {AGENT_NAME}"
    )

    print(
        f"Backend URL: {BACKEND_URL}"
    )

    print(
        f"Collection Interval: {INTERVAL_SECONDS}s"
    )

    print(
        f"CPU Monitoring: {ENABLE_CPU}"
    )

    print(
        f"Memory Monitoring: {ENABLE_MEMORY}"
    )

    print(
        f"Disk Monitoring: {ENABLE_DISK}"
    )

    print(
        f"Network Monitoring: {ENABLE_NETWORK}"
    )

    print(
        f"Process Monitoring: {ENABLE_PROCESS}"
    )

    print()
