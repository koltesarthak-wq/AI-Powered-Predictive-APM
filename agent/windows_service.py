"""Windows service entry point and a one-shot connectivity diagnostic."""
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import sys
import threading

import servicemanager
import win32event
import win32service
import win32serviceutil

PROJECT_DIR = (Path(sys.executable).resolve().parent if getattr(sys, "frozen", False)
               else Path(__file__).resolve().parent.parent)
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))


class LogStream:
    def write(self, message):
        if message.strip():
            logging.getLogger("agent").info(message.rstrip())
    def flush(self):
        pass


def configure_service_logging():
    directory = Path(os.environ.get("PROGRAMDATA", str(PROJECT_DIR))) / "PredictiveAPM" / "logs"
    directory.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(directory / "agent.log", maxBytes=2_000_000,
                                  backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
    sys.stdout = LogStream()
    sys.stderr = LogStream()


class AIPredictiveAPMAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "AIPredictiveAPMAgent"
    _svc_display_name_ = "Predictive APM Host Agent"
    _svc_description_ = "Sends CPU, memory, disk and process readings to your Predictive APM backend."

    def __init__(self, args):
        super().__init__(args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.stopping = threading.Event()
        self.agent = None

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING, waitHint=30000)
        self.stopping.set()
        if self.agent is not None:
            self.agent.stop()
        win32event.SetEvent(self.stop_event)

    def SvcRun(self):
        self.ReportServiceStatus(win32service.SERVICE_START_PENDING, waitHint=30000)
        self.SvcDoRun()
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)

    def SvcDoRun(self):
        configure_service_logging()
        try:
            from agent.agent import APMMonitoringAgent
            self.agent = APMMonitoringAgent()
            if self.stopping.is_set():
                return
            logging.info("APM service started from %s", PROJECT_DIR)
            self.ReportServiceStatus(win32service.SERVICE_RUNNING)
            self.agent.run()
            if not self.stopping.is_set():
                raise RuntimeError("The monitoring loop stopped unexpectedly")
            logging.info("APM service stopped")
        except Exception:
            logging.exception("APM service failed")
            # pywin32 reports STOPPED with a failure code when SvcDoRun raises.
            raise

    def SvcShutdown(self):
        self.SvcStop()


def check_once():
    """Collect and transmit one real sample, without installing any service."""
    import requests
    from agent.agent import APMMonitoringAgent
    from agent.config import METRICS_ENDPOINT, HEARTBEAT_ENDPOINT
    agent = APMMonitoringAgent()
    metrics = agent.collect_metrics()
    response = requests.post(METRICS_ENDPOINT, json=metrics, timeout=15)
    response.raise_for_status()
    requests.post(HEARTBEAT_ENDPOINT, json={
        "agent_name": agent.agent_name, "hostname": agent.hostname,
        "status": "ONLINE", "timestamp": metrics["timestamp"]}, timeout=10).raise_for_status()
    print(json.dumps({"status": "connected", "hostname": agent.hostname,
                      "cpu_usage_percent": metrics["cpu_usage_percent"],
                      "memory_usage_percent": metrics["memory_usage_percent"]}))


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "--check":
        check_once()
    elif len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(AIPredictiveAPMAgentService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(AIPredictiveAPMAgentService)


if __name__ == "__main__":
    main()
