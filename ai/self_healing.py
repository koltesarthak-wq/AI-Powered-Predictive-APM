import gc
import time


class SelfHealingEngine:

    def __init__(self):

        self.last_action = "NONE"

        self.last_status = "NOT_REQUIRED"

        self.healing_count = 0

        self.success_count = 0

        self.failure_count = 0


    # =====================================================
    # HEAL
    # =====================================================

    def heal(
        self,
        cpu,
        memory,
        latency,
        error_rate,
        anomaly,
        root_cause,
        risk
    ):

        # -------------------------------------------------
        # NORMAL SYSTEM
        # -------------------------------------------------

        if not anomaly:

            self.last_action = "NONE"

            self.last_status = "NOT_REQUIRED"

            return {

                "status":
                    "NOT_REQUIRED",

                "action":
                    "NONE",

                "message":
                    "System is operating normally."

            }


        # -------------------------------------------------
        # HIGH MEMORY
        # -------------------------------------------------

        if memory >= 90:

            self.last_action = (
                "MEMORY_CLEANUP"
            )

            self.last_status = (
                "ACTION_EXECUTED"
            )

            self.healing_count += 1

            try:

                gc.collect()

                time.sleep(1)

                self.success_count += 1

                return {

                    "status":
                        "ACTION_EXECUTED",

                    "action":
                        "MEMORY_CLEANUP",

                    "message":
                        "Python garbage collection executed successfully."

                }

            except Exception as e:

                self.failure_count += 1

                self.last_status = (
                    "ACTION_FAILED"
                )

                return {

                    "status":
                        "ACTION_FAILED",

                    "action":
                        "MEMORY_CLEANUP",

                    "message":
                        str(e)

                }


        # -------------------------------------------------
        # HIGH CPU
        # -------------------------------------------------

        if cpu >= 90:

            self.last_action = (
                "CPU_MONITORING"
            )

            self.last_status = (
                "RECOMMENDATION"
            )

            self.healing_count += 1

            return {

                "status":
                    "RECOMMENDATION",

                "action":
                    "CPU_MONITORING",

                "message":
                    "CPU usage is critically high. Identify CPU-intensive processes."

            }


        # -------------------------------------------------
        # HIGH LATENCY
        # -------------------------------------------------

        if latency >= 2:

            self.last_action = (
                "LATENCY_MONITORING"
            )

            self.last_status = (
                "RECOMMENDATION"
            )

            self.healing_count += 1

            return {

                "status":
                    "RECOMMENDATION",

                "action":
                    "LATENCY_MONITORING",

                "message":
                    "Application latency is high. Investigate slow requests."

            }


        # -------------------------------------------------
        # HIGH ERROR RATE
        # -------------------------------------------------

        if error_rate >= 10:

            self.last_action = (
                "ERROR_MONITORING"
            )

            self.last_status = (
                "RECOMMENDATION"
            )

            self.healing_count += 1

            return {

                "status":
                    "RECOMMENDATION",

                "action":
                    "ERROR_MONITORING",

                "message":
                    "Application error rate is high. Investigate failing requests."

            }


        # -------------------------------------------------
        # GENERAL ANOMALY
        # -------------------------------------------------

        self.last_action = (
            "GENERAL_MONITORING"
        )

        self.last_status = (
            "RECOMMENDATION"
        )

        self.healing_count += 1

        return {

            "status":
                "RECOMMENDATION",

            "action":
                "GENERAL_MONITORING",

            "message":
                "Anomaly detected. Manual investigation recommended."

        }


    # =====================================================
    # STATUS
    # =====================================================

    def get_status(self):

        return {

            "status":
                self.last_status,

            "last_action":
                self.last_action,

            "healing_count":
                self.healing_count,

            "success_count":
                self.success_count,

            "failure_count":
                self.failure_count

        }
