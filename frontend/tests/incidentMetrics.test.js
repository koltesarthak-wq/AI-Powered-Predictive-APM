import test from "node:test";
import assert from "node:assert/strict";
import { readIncidentMetrics, formatIncidentMetric, isZeroSnapshot } from "../src/incidentMetrics.js";

test("reads the nested snapshot returned by the incidents API", () => {
  const snapshot = readIncidentMetrics({
    incident_id: "INC-TEST",
    risk: "MEDIUM",
    metrics: { cpu: 37.2, memory: 86.3, latency: 0.1234, error_rate: 0.42 },
  });
  assert.deepEqual(snapshot, { cpu: 37.2, memory: 86.3, latency: 0.1234, errorRate: 0.42 });
  assert.equal(formatIncidentMetric(snapshot.cpu, 1, "%"), "37.2%");
  assert.equal(formatIncidentMetric(snapshot.memory, 1, "%"), "86.3%");
  assert.equal(formatIncidentMetric(snapshot.latency, 3, " s"), "0.123 s");
  assert.equal(formatIncidentMetric(snapshot.errorRate, 2, "%"), "0.42%");
});

test("preserves genuine snapshot zeros instead of falling back to newer values", () => {
  const snapshot = readIncidentMetrics({ cpu: 90, memory: 80, metrics: { cpu: 0, memory: 0, latency: 0, error_rate: 0 } });
  assert.equal(snapshot.cpu, 0);
  assert.equal(snapshot.memory, 0);
  assert.equal(isZeroSnapshot(snapshot), true);
  assert.equal(formatIncidentMetric(snapshot.cpu, 1, "%"), "0.0%");
});

test("missing or invalid readings do not become zero", () => {
  const snapshot = readIncidentMetrics({ metrics: { cpu: "", memory: false, latency: "invalid" } });
  assert.deepEqual(snapshot, { cpu: null, memory: null, latency: null, errorRate: null });
  assert.equal(isZeroSnapshot(snapshot), false);
  for (const value of [null, undefined, "", " ", false, NaN, Infinity, {}, "invalid"]) {
    assert.equal(formatIncidentMetric(value, 1, "%"), "Not recorded");
  }
});

test("supports older top-level payloads", () => {
  assert.deepEqual(readIncidentMetrics({ cpu_usage_percent: 42, memory_usage: 65, latency_seconds: 0.2, error_rate_percent: 1 }),
    { cpu: 42, memory: 65, latency: 0.2, errorRate: 1 });
});

test("small positive latency and error rates are not rounded to a false zero", () => {
  assert.equal(formatIncidentMetric(0.00012, 3, " s"), "<0.001 s");
  assert.equal(formatIncidentMetric(0.004, 2, "%"), "<0.01%");
  assert.equal(formatIncidentMetric(0, 3, " s"), "0.000 s");
});
