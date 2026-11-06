import time
import socket
import platform
import requests
import psutil
import threading

from datetime import datetime, timezone

from agent.config import (
    AGENT_NAME,
    METRICS_ENDPOINT,
    HEARTBEAT_ENDPOINT,
    INTERVAL_SECONDS
)

from agent.process_monitor import ProcessMonitor


class APMMonitoringAgent:

    def __init__(self):

        self.agent_name = AGENT_NAME
        self.hostname = socket.gethostname()

        self.running = True

        # Process monitoring
        self.process_monitor = ProcessMonitor(
            max_processes=10
        )

        # Heartbeat interval
        self.heartbeat_interval = 5

        print("[AGENT] Configuration loaded")
        print(f"[AGENT] Agent Name: {self.agent_name}")
        print(f"[AGENT] Backend: {METRICS_ENDPOINT}")
        print(
            f"[AGENT] Collection Interval: "
            f"{INTERVAL_SECONDS}s"
        )
        print("[AGENT] Process monitoring enabled")
        print(
            f"[AGENT] Heartbeat interval: "
            f"{self.heartbeat_interval}s"
        )


    # =================================================
    # COLLECT SYSTEM METRICS
    # =================================================

    def collect_metrics(self):

        cpu = psutil.cpu_percent(
            interval=1
        )

        memory = psutil.virtual_memory()

        # Windows disk
        disk = psutil.disk_usage("C:\\")

        boot_time = psutil.boot_time()

        uptime = time.time() - boot_time

        # =================================================
        # PROCESS MONITORING
        # =================================================

        processes = self.process_monitor.collect_processes()

        metrics = {

            "agent_name":
                self.agent_name,

            "hostname":
                self.hostname,

            "platform":
                platform.system(),

            "platform_version":
                platform.version(),

            # System metrics
            "cpu_usage_percent":
                cpu,

            "memory_usage_percent":
                memory.percent,

            "memory_total_mb":
                round(
                    memory.total /
                    (1024 * 1024),
                    2
                ),

            "memory_available_mb":
                round(
                    memory.available /
                    (1024 * 1024),
                    2
                ),

            "disk_usage_percent":
                disk.percent,

            "uptime_seconds":
                round(
                    uptime,
                    2
                ),

            # Process metrics
            "processes":
                processes,

            "process_count":
                len(processes),

            "timestamp":
                datetime.now(
                    timezone.utc
                ).isoformat()

        }

        return metrics


    # =================================================
    # SEND METRICS TO BACKEND
    # =================================================

    def send_metrics(self, metrics):

        try:

            response = requests.post(
                METRICS_ENDPOINT,
                json=metrics,
                timeout=10
            )

            if response.ok:

                print(
                    "[AGENT] Metrics sent successfully"
                )

                print(
                    f"[AGENT] Processes monitored: "
                    f"{metrics['process_count']}"
                )

            else:

                print(
                    "[AGENT] Backend returned:",
                    response.status_code
                )

                print(
                    "[AGENT] Response:",
                    response.text
                )

        except Exception as error:

            print(
                "[AGENT] Backend unavailable:",
                error
            )


    # =================================================
    # HEARTBEAT
    # =================================================

    def send_heartbeat(self):

        try:

            payload = {

                "agent_name":
                    self.agent_name,

                "hostname":
                    self.hostname,

                "status":
                    "ONLINE",

                "timestamp":
                    datetime.now(
                        timezone.utc
                    ).isoformat()

            }

            response = requests.post(
                HEARTBEAT_ENDPOINT,
                json=payload,
                timeout=5
            )

            if response.ok:

                print(
                    "[AGENT] Heartbeat sent"
                )

            else:

                print(
                    "[AGENT] Heartbeat returned:",
                    response.status_code
                )

        except Exception as error:

            print(
                "[AGENT] Heartbeat failed:",
                error
            )


    # =================================================
    # INDEPENDENT HEARTBEAT LOOP
    # =================================================

    def heartbeat_loop(self):

        print(
            "[AGENT] Heartbeat thread started"
        )

        while self.running:

            try:

                self.send_heartbeat()

            except Exception as error:

                print(
                    "[AGENT] Heartbeat thread error:",
                    error
                )

            # Wait without blocking the main monitoring loop
            for _ in range(self.heartbeat_interval):

                if not self.running:
                    break

                time.sleep(1)

        print(
            "[AGENT] Heartbeat thread stopped"
        )


    # =================================================
    # DISPLAY TOP PROCESSES
    # =================================================

    def display_processes(self, processes):

        print(
            "\n[AGENT] ===== TOP PROCESSES ====="
        )

        for process in processes[:5]:

            print(
                f"[PROCESS] "
                f"{process['name']} | "
                f"PID={process['pid']} | "
                f"CPU={process['cpu_usage_percent']}% | "
                f"RAM={process['memory_usage_mb']} MB"
            )


    # =================================================
    # MAIN LOOP
    # =================================================

    def run(self):

        print(
            f"[AGENT] {self.agent_name} started"
        )

        print(
            f"[AGENT] Hostname: {self.hostname}"
        )

        print(
            "[AGENT] Monitoring started..."
        )

        # =================================================
        # START HEARTBEAT THREAD
        # =================================================

        heartbeat_thread = threading.Thread(
            target=self.heartbeat_loop,
            name="APM-Heartbeat",
            daemon=True
        )

        heartbeat_thread.start()

        # =================================================
        # MAIN MONITORING LOOP
        # =================================================

        while self.running:

            try:

                metrics = self.collect_metrics()

                # System metrics
                print(
                    "[AGENT] CPU:",
                    metrics["cpu_usage_percent"],
                    "%"
                )

                print(
                    "[AGENT] Memory:",
                    metrics["memory_usage_percent"],
                    "%"
                )

                print(
                    "[AGENT] Disk:",
                    metrics["disk_usage_percent"],
                    "%"
                )

                # Process metrics
                self.display_processes(
                    metrics["processes"]
                )

                # Send everything to backend
                self.send_metrics(
                    metrics
                )

            except Exception as error:

                print(
                    "[AGENT] Error:",
                    error
                )

            # Main collection interval
            for _ in range(INTERVAL_SECONDS):

                if not self.running:
                    break

                time.sleep(1)

        # Wait for heartbeat thread to finish
        heartbeat_thread.join(
            timeout=self.heartbeat_interval + 1
        )

        print(
            "[AGENT] Monitoring loop stopped"
        )


    # =================================================
    # STOP
    # =================================================

    def stop(self):

        self.running = False

        print(
            "[AGENT] Agent stopped"
        )


# =====================================================
# START AGENT
# =====================================================

if __name__ == "__main__":

    agent = APMMonitoringAgent()

    try:

        agent.run()

    except KeyboardInterrupt:

        agent.stop()