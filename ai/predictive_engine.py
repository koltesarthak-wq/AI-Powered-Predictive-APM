class PredictiveEngine:

    def predict_risk(
        self,
        cpu,
        memory,
        latency,
        error_rate
    ):

        risk_score = 0
        warnings = []

        # CPU prediction
        if cpu >= 80:
            risk_score += 30
            warnings.append(
                "CPU usage is high and may cause future performance degradation."
            )
        elif cpu >= 60:
            risk_score += 15

        # Memory prediction
        if memory >= 90:
            risk_score += 40
            warnings.append(
                "Memory usage is critically high and may lead to performance issues."
            )
        elif memory >= 80:
            risk_score += 20

        # Latency prediction
        if latency >= 0.5:
            risk_score += 20
            warnings.append(
                "High request latency may indicate future application slowdown."
            )
        elif latency >= 0.2:
            risk_score += 10

        # Error-rate prediction
        if error_rate >= 5:
            risk_score += 20
            warnings.append(
                "High error rate may indicate increasing application failures."
            )
        elif error_rate >= 1:
            risk_score += 10

        # Determine risk level
        if risk_score >= 60:
            risk = "HIGH"

        elif risk_score >= 30:
            risk = "MEDIUM"

        else:
            risk = "LOW"

        # Default message
        if not warnings:
            warnings.append(
                "No significant future performance risk detected."
            )

        return {
            "risk": risk,
            "risk_score": risk_score,
            "predictions": warnings
        }