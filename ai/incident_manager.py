from datetime import datetime
import uuid


class IncidentManager:

    def __init__(self):

        self.incidents = []

    # =====================================================
    # CREATE INCIDENT
    # =====================================================

    def create_incident(
        self,
        severity,
        problem,
        root_cause,
        risk,
        cpu,
        memory,
        latency,
        error_rate
    ):

        incident = {

            "incident_id":
                f"INC-{uuid.uuid4().hex[:8].upper()}",

            "severity":
                severity,

            "status":
                "OPEN",

            "problem":
                problem,

            "root_cause":
                root_cause,

            "risk":
                risk,

            "metrics": {

                "cpu":
                    round(cpu, 2),

                "memory":
                    round(memory, 2),

                "latency":
                    round(latency, 4),

                "error_rate":
                    round(error_rate, 2)
            },

            "created_at":
                datetime.now().isoformat(),

            "resolved_at":
                None
        }

        self.incidents.append(incident)

        print(
            f"[INCIDENT] Created: "
            f"{incident['incident_id']} | "
            f"Severity={severity} | "
            f"Problem={problem}"
        )

        return incident

    # =====================================================
    # RESOLVE INCIDENT
    # =====================================================

    def resolve_incident(
        self,
        incident_id
    ):

        for incident in self.incidents:

            if incident["incident_id"] == incident_id:

                incident["status"] = "RESOLVED"

                incident["resolved_at"] = (
                    datetime.now().isoformat()
                )

                print(
                    f"[INCIDENT] Resolved: "
                    f"{incident_id}"
                )

                return incident

        return None

    # =====================================================
    # ESCALATE INCIDENT
    # =====================================================

    def escalate_incident(
        self,
        incident_id
    ):

        for incident in self.incidents:

            if incident["incident_id"] == incident_id:

                incident["status"] = "ESCALATED"

                print(
                    f"[INCIDENT] Escalated: "
                    f"{incident_id}"
                )

                return incident

        return None

    # =====================================================
    # GET ALL INCIDENTS
    # =====================================================

    def get_incidents(self):

        return self.incidents

    # =====================================================
    # GET OPEN INCIDENTS
    # =====================================================

    def get_open_incidents(self):

        return [

            incident

            for incident in self.incidents

            if incident["status"] == "OPEN"

        ]

    # =====================================================
    # GET INCIDENT BY ID
    # =====================================================

    def get_incident(
        self,
        incident_id
    ):

        for incident in self.incidents:

            if incident["incident_id"] == incident_id:

                return incident

        return None