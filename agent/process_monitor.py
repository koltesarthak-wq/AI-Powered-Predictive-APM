import psutil


class ProcessMonitor:

    def __init__(self, max_processes=10):
        self.max_processes = max_processes


    def collect_processes(self):

        processes = []

        for process in psutil.process_iter(
            ["pid", "name", "username", "memory_info"]
        ):

            try:

                pid = process.info["pid"]
                name = process.info["name"]

                if not name:
                    continue

                # Ignore System Idle Process because
                # Windows reports its CPU differently.
                if pid == 0 or name.lower() == "system idle process":
                    continue

                # Get CPU usage
                cpu_percent = process.cpu_percent(interval=0.05)

                # Keep CPU between 0 and 100
                cpu_percent = max(
                    0,
                    min(cpu_percent, 100)
                )

                # Memory
                memory_info = process.info["memory_info"]

                if memory_info:

                    memory_mb = round(
                        memory_info.rss /
                        (1024 * 1024),
                        2
                    )

                else:

                    memory_mb = 0

                processes.append({

                    "pid":
                        pid,

                    "name":
                        name,

                    "cpu_usage_percent":
                        round(
                            cpu_percent,
                            2
                        ),

                    "memory_usage_mb":
                        memory_mb

                })

            except (
                psutil.NoSuchProcess,
                psutil.AccessDenied,
                psutil.ZombieProcess
            ):

                continue

            except Exception:

                continue


        # Sort by CPU usage
        processes.sort(
            key=lambda x:
                x["cpu_usage_percent"],
            reverse=True
        )

        return processes[
            :self.max_processes
        ]


# =====================================================
# TEST PROCESS MONITOR
# =====================================================

if __name__ == "__main__":

    monitor = ProcessMonitor(
        max_processes=10
    )

    processes = monitor.collect_processes()

    print()
    print(
        "===== TOP PROCESSES ====="
    )

    for process in processes:

        print(
            f"{process['name']:<30}"
            f" PID={process['pid']:<7}"
            f" CPU={process['cpu_usage_percent']:>6}%"
            f" RAM={process['memory_usage_mb']:>8} MB"
        )