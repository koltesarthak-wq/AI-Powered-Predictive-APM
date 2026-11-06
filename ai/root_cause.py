class RootCauseAnalyzer:

    def analyze(self, cpu, memory, latency, error_rate, anomaly):

        problems = []
        recommendations = []

        # CPU analysis
        if cpu >= 80:
            problems.append("High CPU usage")
            recommendations.append(
                "Investigate CPU-intensive processes and consider scaling CPU resources."
            )

        # Memory analysis
        if memory >= 80:
            problems.append("High memory usage")
            recommendations.append(
                "Identify memory-intensive processes and consider increasing available memory."
            )

        # Latency analysis
        if latency >= 0.5:
            problems.append("High request latency")
            recommendations.append(
                "Investigate slow requests, database queries, or overloaded services."
            )

        # Error rate analysis
        if error_rate >= 5:
            problems.append("High error rate")
            recommendations.append(
                "Check application logs and failed API requests for errors."
            )

        # If ML detected anomaly but thresholds did not identify a problem
        if anomaly and not problems:
            problems.append(
                "Unusual system behavior detected by AI model"
            )

            recommendations.append(
                "Investigate recent changes in application performance and system resources."
            )

        # Normal condition
        if not anomaly and not problems:
            problems.append("No significant performance issue detected")

            recommendations.append(
                "Continue monitoring system performance."
            )

        return {
            "problems": problems,
            "recommendations": recommendations
        }