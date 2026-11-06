# Windows host installer

In Application Monitoring, choose **Install Host Agent**, enter the reachable backend URL,
choose **Create Windows Installer**, and download the EXE. Open the downloaded EXE,
approve Windows administrator permission, and choose Install. No Python or ZIP extraction
is needed on the monitored computer. Supports Windows 10/11 and compatible Windows Server,
x64. The binary is not code-signed; Windows may show an unknown publisher warning.

Setup installs `AIPredictiveAPMAgent` into Program Files, starts it, sets automatic startup,
and configures Windows recovery after failure. Re-running setup updates the existing
service/configuration. Remove it from Windows Settings > Apps > Installed apps.
Rotating logs are kept at `%ProgramData%\PredictiveAPM\logs\agent.log`.

The data path is **host service → configured FastAPI backend → website dashboard**.
An offline backend does not prevent installation; the running agent retries on subsequent
collection cycles. Setup confirms the service is running, not that the backend accepted data.
Host CPU, memory, disk and processes are collected. Application request latency, error rates,
and distributed traces still require application instrumentation.

For another PC, use the backend computer's reachable LAN address (for example
`http://192.168.1.10:8001`) or an HTTPS deployment URL. `127.0.0.1` is only for a backend
on the same computer. FastAPI must listen on the network interface and accept inbound
connections on its configured port. Browser origin and backend URL are separate addresses.

This BE project currently has one shared backend workspace. The URL selects that workspace;
per-customer tenant isolation and agent enrollment authentication are not implemented.
Do not treat an agent name as a security boundary for multiple customers.

## Build on the backend computer

1. Install project dependencies into `.venv` and install `pyinstaller==6.22.3` there.
2. Install [Inno Setup](https://jrsoftware.org/isdl.php), or use its portable installation
   in `tools/inno`. Alternatively set `APM_ISCC_PATH` to the full `ISCC.exe` path.
3. Run `powershell -ExecutionPolicy Bypass -File agent/deployment/build-agent.ps1`.
4. Restart FastAPI after updating the backend source. The website builds configured EXEs
   on demand with the compiler; missing tools produce an actionable error.

`AI-Predictive-APM-Agent.spec` packages the runtime into
`agent/deployment/release/runtime`. Keep the complete directory including `_internal`.
The setup compiler embeds this runtime and the chosen connection configuration. Deployment
metadata and EXEs are stored under `agent/deployment/generated/<id>` so download links
remain usable after a backend restart. The old ZIP/BAT release is retained for compatibility
but is no longer used by the website's installer flow.

## Validation

The runtime supports `AI-Predictive-APM-Agent.exe --check`: it collects and sends one actual
host sample plus a heartbeat using `config.json` beside the EXE, then exits nonzero if the
backend rejects the request. It does not install or modify a Windows service.

After installation, check `Get-Service AIPredictiveAPMAgent`, the host in Application
Monitoring, and the service log. Reboot validation and elevated install/upgrade/uninstall
testing must be performed on a Windows test host with administrator approval.
