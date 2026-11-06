"""In-memory service observability primitives used by the APM API.

The store deliberately keeps a bounded recent history.  It is useful for a
single-node deployment and gives the HTTP API a stable contract; a production
deployment can replace this class with ClickHouse, Prometheus, or another
time-series backend without changing callers.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Any
import uuid


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_timestamp(value: datetime | None = None) -> str:
    return (value or utc_now()).isoformat()


def parse_timestamp(value: str | None) -> datetime:
    if not value:
        return utc_now()

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return utc_now()

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def percentile(values: list[float], target: float) -> float:
    if not values:
        return 0.0

    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round((len(ordered) - 1) * target)))
    return round(ordered[index], 2)


@dataclass(frozen=True)
class TelemetryPoint:
    service_name: str
    service_type: str
    environment: str
    hostname: str | None
    received_at: datetime
    occurred_at: datetime
    request_count: int
    error_count: int
    response_time_ms: float | None
    cpu_usage_percent: float | None
    memory_usage_percent: float | None
    attributes: dict[str, str]


class ObservabilityStore:
    """Keeps a bounded, thread-safe view of service telemetry and topology."""

    def __init__(self, history_limit: int = 720, trace_limit: int = 500):
        self._history_limit = history_limit
        self._trace_limit = trace_limit
        self._points: dict[str, deque[TelemetryPoint]] = {}
        self._entities: dict[str, dict[str, Any]] = {}
        self._edges: set[tuple[str, str, str]] = set()
        self._alerts: dict[tuple[str, str], dict[str, Any]] = {}
        self._traces: deque[dict[str, Any]] = deque(maxlen=trace_limit)
        self._lock = RLock()

    @staticmethod
    def _key(environment: str, service_name: str) -> str:
        return f"{environment}:{service_name}"

    @staticmethod
    def _safe_text(value: Any, default: str, limit: int = 120) -> str:
        text = str(value or default).strip()
        return (text or default)[:limit]

    @staticmethod
    def _number(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def ingest(self, payload: dict[str, Any]) -> dict[str, Any]:
        service_name = self._safe_text(payload.get("service_name"), "unnamed-service")
        service_type = self._safe_text(payload.get("service_type"), "service")
        environment = self._safe_text(payload.get("environment"), "default")
        hostname = self._safe_text(payload.get("hostname"), "", 255) or None
        metrics = payload.get("metrics") or {}
        attributes = {
            self._safe_text(key, "attribute", 60): self._safe_text(value, "", 255)
            for key, value in (payload.get("attributes") or {}).items()
        }
        occurred_at = parse_timestamp(payload.get("timestamp"))
        point = TelemetryPoint(
            service_name=service_name,
            service_type=service_type,
            environment=environment,
            hostname=hostname,
            received_at=utc_now(),
            occurred_at=occurred_at,
            request_count=max(0, int(metrics.get("request_count") or 0)),
            error_count=max(0, int(metrics.get("error_count") or 0)),
            response_time_ms=self._number(metrics.get("response_time_ms")),
            cpu_usage_percent=self._number(metrics.get("cpu_usage_percent")),
            memory_usage_percent=self._number(metrics.get("memory_usage_percent")),
            attributes=attributes,
        )

        with self._lock:
            key = self._key(environment, service_name)
            history = self._points.setdefault(
                key, deque(maxlen=self._history_limit)
            )
            history.append(point)
            entity = self._entities.setdefault(
                key,
                {
                    "id": key,
                    "name": service_name,
                    "type": service_type,
                    "environment": environment,
                    "first_seen": iso_timestamp(point.received_at),
                },
            )
            entity.update(
                {
                    "type": service_type,
                    "hostname": hostname,
                    "last_seen": iso_timestamp(point.received_at),
                    "attributes": attributes,
                }
            )

            for dependency in payload.get("dependencies") or []:
                dependency_name = self._safe_text(
                    dependency.get("service_name"), "unknown-dependency"
                )
                dependency_type = self._safe_text(
                    dependency.get("service_type"), "service"
                )
                dependency_environment = self._safe_text(
                    dependency.get("environment"), environment
                )
                dependency_key = self._key(dependency_environment, dependency_name)
                self._entities.setdefault(
                    dependency_key,
                    {
                        "id": dependency_key,
                        "name": dependency_name,
                        "type": dependency_type,
                        "environment": dependency_environment,
                        "first_seen": iso_timestamp(point.received_at),
                        "last_seen": None,
                        "attributes": {},
                    },
                )
                self._edges.add((key, dependency_key, dependency_type))

            trace = payload.get("trace")
            if trace:
                self._traces.appendleft(
                    {
                        "trace_id": self._safe_text(
                            trace.get("trace_id"), uuid.uuid4().hex, 128
                        ),
                        "span_id": self._safe_text(trace.get("span_id"), uuid.uuid4().hex[:16], 128),
                        "parent_span_id": trace.get("parent_span_id"),
                        "service_name": service_name,
                        "environment": environment,
                        "operation": self._safe_text(trace.get("operation"), "request", 255),
                        "duration_ms": self._number(trace.get("duration_ms"))
                        or point.response_time_ms
                        or 0.0,
                        "status": self._safe_text(trace.get("status"), "OK", 32).upper(),
                        "timestamp": iso_timestamp(occurred_at),
                    }
                )

            summary = self._service_summary_locked(key)
            self._update_alerts_locked(summary)
            return summary

    def record_http_request(
        self, endpoint: str, method: str, status_code: int, duration_seconds: float,
        hostname: str,
    ) -> None:
        self.ingest(
            {
                "service_name": "predictive-apm-api",
                "service_type": "web-service",
                "environment": "local",
                "hostname": hostname,
                "metrics": {
                    "request_count": 1,
                    "error_count": 1 if status_code >= 500 else 0,
                    "response_time_ms": round(duration_seconds * 1000, 2),
                },
                "attributes": {"http.method": method, "http.route": endpoint},
                "trace": {
                    "operation": f"{method} {endpoint}",
                    "duration_ms": round(duration_seconds * 1000, 2),
                    "status": "ERROR" if status_code >= 500 else "OK",
                },
            }
        )

    def _active_points_locked(self, key: str) -> list[TelemetryPoint]:
        cutoff = utc_now() - timedelta(minutes=15)
        return [point for point in self._points.get(key, []) if point.received_at >= cutoff]

    def _service_summary_locked(self, key: str) -> dict[str, Any]:
        entity = self._entities[key]
        points = self._active_points_locked(key)
        request_count = sum(point.request_count for point in points)
        error_count = sum(point.error_count for point in points)
        error_rate = (error_count / request_count * 100) if request_count else 0.0
        latencies = [point.response_time_ms for point in points if point.response_time_ms is not None]
        cpu = [point.cpu_usage_percent for point in points if point.cpu_usage_percent is not None]
        memory = [point.memory_usage_percent for point in points if point.memory_usage_percent is not None]
        p95_latency = percentile(latencies, 0.95)
        latest_latency = latencies[-1] if latencies else 0.0
        availability = max(0.0, 100.0 - error_rate)

        if error_rate >= 10 or p95_latency >= 2000 or max(cpu or [0]) >= 95:
            health = "CRITICAL"
        elif error_rate >= 2 or p95_latency >= 750 or max(cpu or [0]) >= 85:
            health = "WARNING"
        else:
            health = "HEALTHY"

        health_score = 100
        health_score -= min(50, round(error_rate * 5))
        health_score -= 25 if p95_latency >= 2000 else 12 if p95_latency >= 750 else 0
        health_score -= 20 if max(cpu or [0]) >= 95 else 10 if max(cpu or [0]) >= 85 else 0
        health_score -= 15 if max(memory or [0]) >= 95 else 8 if max(memory or [0]) >= 85 else 0

        return {
            **entity,
            "health": health,
            "health_score": max(0, health_score),
            "slo": {
                "target_availability_percent": 99.9,
                "availability_percent": round(availability, 2),
                "status": "MET" if availability >= 99.9 else "AT_RISK",
            },
            "metrics": {
                "request_count": request_count,
                "error_count": error_count,
                "error_rate_percent": round(error_rate, 2),
                "p95_latency_ms": p95_latency,
                "latest_latency_ms": round(latest_latency, 2),
                "cpu_usage_percent": round(cpu[-1], 2) if cpu else None,
                "memory_usage_percent": round(memory[-1], 2) if memory else None,
                "sample_count": len(points),
            },
        }

    def _update_alerts_locked(self, service: dict[str, Any]) -> None:
        metrics = service["metrics"]
        checks = [
            ("high-error-rate", metrics["error_rate_percent"] >= 5, "High error rate", metrics["error_rate_percent"], "%"),
            ("high-latency", metrics["p95_latency_ms"] >= 1000, "High p95 latency", metrics["p95_latency_ms"], "ms"),
            ("high-cpu", (metrics["cpu_usage_percent"] or 0) >= 90, "High CPU usage", metrics["cpu_usage_percent"] or 0, "%"),
            ("high-memory", (metrics["memory_usage_percent"] or 0) >= 90, "High memory usage", metrics["memory_usage_percent"] or 0, "%"),
        ]
        for rule, active, title, value, unit in checks:
            key = (service["id"], rule)
            if active:
                severity = "CRITICAL" if service["health"] == "CRITICAL" else "WARNING"
                existing = self._alerts.get(key)
                self._alerts[key] = {
                    "id": existing["id"] if existing else f"ALT-{uuid.uuid4().hex[:10].upper()}",
                    "service_id": service["id"],
                    "service_name": service["name"],
                    "rule": rule,
                    "title": title,
                    "severity": severity,
                    "status": "OPEN",
                    "value": value,
                    "unit": unit,
                    "opened_at": existing["opened_at"] if existing else iso_timestamp(),
                    "updated_at": iso_timestamp(),
                }
            elif key in self._alerts:
                del self._alerts[key]

    def services(self) -> list[dict[str, Any]]:
        with self._lock:
            return sorted(
                (self._service_summary_locked(key) for key in self._entities),
                key=lambda service: (service["health"] != "CRITICAL", service["name"]),
            )

    def service(self, service_id: str) -> dict[str, Any] | None:
        with self._lock:
            if service_id not in self._entities:
                return None
            return self._service_summary_locked(service_id)

    def timeseries(
        self, service_id: str, limit: int = 60
    ) -> list[dict[str, Any]] | None:
        """Return recent raw points for a service data-explorer chart."""

        with self._lock:
            if service_id not in self._entities:
                return None

            points = list(self._points.get(service_id, []))[
                -max(1, min(limit, self._history_limit)):
            ]

            return [
                {
                    "timestamp": iso_timestamp(point.occurred_at),
                    "request_count": point.request_count,
                    "error_count": point.error_count,
                    "response_time_ms": point.response_time_ms,
                    "cpu_usage_percent": point.cpu_usage_percent,
                    "memory_usage_percent": point.memory_usage_percent,
                }
                for point in points
            ]

    def overview(self) -> dict[str, Any]:
        with self._lock:
            services = [
                self._service_summary_locked(key)
                for key in self._entities
            ]
            request_count = sum(
                service["metrics"]["request_count"]
                for service in services
            )
            error_count = sum(
                service["metrics"]["error_count"]
                for service in services
            )
            availability = (
                100.0 - (error_count / request_count * 100)
                if request_count
                else 100.0
            )
            health_counts = {
                health: sum(
                    service["health"] == health
                    for service in services
                )
                for health in ("HEALTHY", "WARNING", "CRITICAL")
            }
            return {
                "generated_at": iso_timestamp(),
                "services": {"total": len(services), **health_counts},
                "alerts": {"open": len(self._alerts)},
                "slo": {
                    "target_availability_percent": 99.9,
                    "availability_percent": round(availability, 2),
                    "status": "MET" if availability >= 99.9 else "AT_RISK",
                },
                "topology": {
                    "nodes": len(self._entities),
                    "edges": len(self._edges)
                },
            }

    def topology(self) -> dict[str, Any]:
        with self._lock:
            services = {service["id"]: service for service in self.services()}
            nodes = [
                {
                    "id": service["id"],
                    "name": service["name"],
                    "type": service["type"],
                    "environment": service["environment"],
                    "health": service["health"],
                }
                for service in services.values()
            ]
            edges = [
                {"source": source, "target": target, "type": edge_type}
                for source, target, edge_type in sorted(self._edges)
            ]
            return {"nodes": nodes, "edges": edges}

    def alerts(self) -> list[dict[str, Any]]:
        with self._lock:
            return sorted(
                self._alerts.values(),
                key=lambda alert: (alert["severity"] != "CRITICAL", alert["opened_at"]),
            )

    def traces(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._traces)[:max(1, min(limit, self._trace_limit))]
