function numericReading(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && !value.trim()) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// The API stores a detection-time snapshot in incident.metrics.
// Retain support for older responses with fields at the top level.
export function readIncidentMetrics(incident = {}) {
  const snapshot = incident.metrics || {};
  return {
    cpu: numericReading(snapshot.cpu ?? snapshot.cpu_usage_percent ?? incident.cpu ?? incident.cpu_usage_percent ?? incident.cpu_usage),
    memory: numericReading(snapshot.memory ?? snapshot.memory_usage_percent ?? incident.memory ?? incident.memory_usage_percent ?? incident.memory_usage),
    latency: numericReading(snapshot.latency ?? snapshot.latency_seconds ?? incident.latency ?? incident.latency_seconds ?? incident.current_latency),
    errorRate: numericReading(snapshot.error_rate ?? snapshot.error_rate_percent ?? incident.error_rate ?? incident.error_rate_percent),
  };
}

export function formatIncidentMetric(value, decimals, unit) {
  const number = numericReading(value);
  if (number === null) return "Not recorded";
  const minimum = 10 ** -decimals;
  if (number > 0 && number < minimum) return "<" + minimum.toFixed(decimals) + unit;
  return number.toFixed(decimals) + unit;
}

export function isZeroSnapshot(metrics) {
  return [metrics.cpu, metrics.memory, metrics.latency, metrics.errorRate].every(value => value === 0);
}
