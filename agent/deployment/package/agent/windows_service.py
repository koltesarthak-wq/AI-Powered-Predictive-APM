import os
import sys
import time
import threading
import traceback
from pathlib import Path

import win32event
import win32service
import win32serviceutil
import servicemanager


# ============================================================
# PORTABLE PROJECT PATH
# ============================================================

# windows_service.py
#   └── agent
#       └── windows_service.py
#
# Therefore:
# parent     = agent
# parent.parent = project/root directory

if getattr(sys, "frozen", False):

    # Keep logs and the working directory beside the installed EXE instead
    # of PyInstaller's temporary extraction directory.
    PROJECT_DIR = Path(sys.executable).resolve().parent

else:

    PROJECT_DIR = Path(__file__).resolve().parent.parent

LOG_FILE = PROJECT_DIR / "agent_service.log"


# ============================================================
# PYTHON PATH
# ============================================================

if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

os.chdir(PROJECT_DIR)


# ============================================================
# LOGGING
# ============================================================

def log(message):

    try:

        timestamp = time.strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        with open(
            LOG_FILE,
            "a",
            encoding="utf-8"
        ) as f:

            f.write(
                f"[{timestamp}] {message}\n"
            )

    except Exception:
        pass


# ============================================================
# WINDOWS SERVICE
# ============================================================

class AIPredictiveAPMAgentService(
    win32serviceutil.ServiceFramework
):

    _svc_name_ = "AIPredictiveAPMAgent"

    _svc_display_name_ = (
        "AI Predictive APM Monitoring Agent"
    )

    _svc_description_ = (
        "AI-Powered Predictive APM host monitoring "
        "agent for CPU, memory, disk, network and "
        "process performance monitoring."
    )


    # ========================================================
    # INITIALIZATION
    # ========================================================

    def __init__(self, args):

        log("================================================")
        log(
            "Initializing AI Predictive APM Windows Service"
        )

        log(
            f"Project directory: {PROJECT_DIR}"
        )

        log(
            f"Python executable: {sys.executable}"
        )

        try:

            win32serviceutil.ServiceFramework.__init__(
                self,
                args
            )

            self.stop_event = (
                win32event.CreateEvent(
                    None,
                    0,
                    0,
                    None
                )
            )

            self.agent_thread = None

            self.agent = None

            log(
                "Service initialization completed"
            )

        except Exception as e:

            log(
                f"ERROR during service initialization: {e}"
            )

            log(
                traceback.format_exc()
            )

            raise


    # ========================================================
    # SERVICE START
    # ========================================================

    def SvcDoRun(self):

        log("Windows Service SvcDoRun() started")

        try:

            servicemanager.LogInfoMsg(
                "AI Predictive APM Agent service started."
            )

            log(
                "Importing agent.agent..."
            )

            from agent.agent import (
                APMMonitoringAgent
            )

            log(
                "agent.agent imported successfully"
            )


            # ------------------------------------------------
            # CREATE AGENT
            # ------------------------------------------------

            log(
                "Creating APMMonitoringAgent instance..."
            )

            self.agent = APMMonitoringAgent()

            log(
                "APMMonitoringAgent instance created"
            )


            # ------------------------------------------------
            # START AGENT THREAD
            # ------------------------------------------------

            self.agent_thread = threading.Thread(
                target=self.run_agent,
                args=(self.agent,),
                daemon=True
            )

            self.agent_thread.start()

            log(
                "Agent monitoring thread started"
            )


            # ------------------------------------------------
            # KEEP SERVICE ALIVE
            # ------------------------------------------------

            log(
                "Service waiting for stop signal..."
            )

            while True:

                result = (
                    win32event.WaitForSingleObject(
                        self.stop_event,
                        1000
                    )
                )

                if (
                    result ==
                    win32event.WAIT_OBJECT_0
                ):

                    log(
                        "Stop signal received"
                    )

                    break


                if self.agent_thread is not None:

                    if not self.agent_thread.is_alive():

                        log(
                            "WARNING: "
                            "Agent thread stopped unexpectedly"
                        )

                        break


            log(
                "SvcDoRun() exiting"
            )

        except Exception as e:

            log(
                f"ERROR inside SvcDoRun(): {e}"
            )

            log(
                traceback.format_exc()
            )

            try:

                servicemanager.LogErrorMsg(
                    f"AI Predictive APM Agent failed: {e}"
                )

            except Exception:
                pass

            raise


    # ========================================================
    # AGENT THREAD
    # ========================================================

    def run_agent(self, agent):

        log(
            "Agent thread started"
        )

        try:

            log(
                "Calling agent.run()"
            )

            agent.run()

            log(
                "agent.run() returned"
            )

        except Exception as e:

            log(
                f"ERROR inside agent thread: {e}"
            )

            log(
                traceback.format_exc()
            )


    # ========================================================
    # SERVICE STOP
    # ========================================================

    def SvcStop(self):

        log(
            "SvcStop() called"
        )

        try:

            self.ReportServiceStatus(
                win32service.SERVICE_STOP_PENDING
            )

            log(
                "Service status set to STOP_PENDING"
            )

            win32event.SetEvent(
                self.stop_event
            )

            log(
                "Stop event signaled"
            )

            if self.agent is not None:

                log(
                    "Stopping the monitoring agent loop..."
                )

                self.agent.stop()


            if self.agent_thread is not None:

                log(
                    "Waiting for agent thread to stop..."
                )

                self.agent_thread.join(
                    timeout=30
                )

                if self.agent_thread.is_alive():

                    log(
                        "WARNING: Agent thread "
                        "did not stop within 30 seconds"
                    )

                else:

                    log(
                        "Agent thread stopped"
                    )


            self.ReportServiceStatus(
                win32service.SERVICE_STOPPED
            )

            log(
                "Service stopped successfully"
            )

        except Exception as e:

            log(
                f"ERROR during service stop: {e}"
            )

            log(
                traceback.format_exc()
            )


# ============================================================
# COMMAND LINE
# ============================================================

if __name__ == "__main__":

    log("================================================")
    log(
        "windows_service.py executed"
    )

    log(
        f"Python executable: {sys.executable}"
    )

    log(
        f"Python version: {sys.version}"
    )

    log(
        f"Project directory: {PROJECT_DIR}"
    )

    try:

        win32serviceutil.HandleCommandLine(
            AIPredictiveAPMAgentService
        )

    except Exception as e:

        log(
            f"COMMAND LINE ERROR: {e}"
        )

        log(
            traceback.format_exc()
        )

        raise
