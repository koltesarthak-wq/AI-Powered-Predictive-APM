class AnomalyDetector:

    def __init__(self):
        self.cpu_threshold = 80
        self.memory_threshold = 85
        self.latency_threshold = 1.0

    def analyze(self, cpu, memory, latency):

        problems = []

        if cpu >= self.cpu_threshold:
            problems.append("High CPU usage")

        if memory >= self.memory_threshold:
            problems.append("High memory usage")

        if latency >= self.latency_threshold:
            problems.append("High request latency")

        if len(problems) >= 2:
            status = "CRITICAL"

        elif len(problems) == 1:
            status = "WARNING"

        else:
            status = "NORMAL"

        return {
            "status": status,
            "problems": problems
        }