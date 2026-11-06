from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import psutil
import time
import threading
import pandas as pd
import socket
import platform

import os
import json
import uuid
import shutil
import zipfile

from pathlib import Path
from datetime import datetime, timezone


from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST
)


# =========================================================
# AUTHENTICATION
# =========================================================

from auth.auth import router as auth_router
from auth.database import Base, engine


# =========================================================
# AI COMPONENTS
# =========================================================

from ai.ml_model import PredictiveAnomalyModel
from ai.root_cause import RootCauseAnalyzer
from ai.predictive_engine import PredictiveEngine
from ai.self_healing import SelfHealingEngine
from ai.incident_manager import IncidentManager
from app.observability import ObservabilityStore
from agent.deployment.installer import (build_installer, load_deployment, validate_url, InstallerBuildError)


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="AI-Powered Predictive APM",
    description="Intelligent Application Performance Monitoring System",
    version="1.0.0"
)


# =========================================================
# PROJECT DIRECTORIES
# =========================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

AGENT_DEPLOYMENT_DIR = (
    PROJECT_ROOT
    / "agent"
    / "deployment"
)

AGENT_RELEASE_DIR = (
    AGENT_DEPLOYMENT_DIR
    / "release"
)

AGENT_GENERATED_DIR = (
    AGENT_DEPLOYMENT_DIR
    / "generated"
)

AGENT_GENERATED_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# =========================================================
# DATABASE
# =========================================================

Base.metadata.create_all(
    bind=engine
)


# =========================================================
# AUTHENTICATION ROUTER
# =========================================================

app.include_router(
    auth_router,
    prefix="/auth",
    tags=["Authentication"]
)


# =========================================================
# CORS
# =========================================================

APM_CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "APM_CORS_ORIGINS",
        ",".join([
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ])
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=APM_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# AI COMPONENTS
# =========================================================

ml_model = PredictiveAnomalyModel()

root_cause_analyzer = RootCauseAnalyzer()

predictive_engine = PredictiveEngine()

self_healing_engine = SelfHealingEngine()

incident_manager = IncidentManager()


# =========================================================
# SERVICE OBSERVABILITY
# =========================================================

# Prometheus exposes raw metrics. This store supplies the service, topology,
# alert, SLO, and trace model used by the product APIs.
observability_store = ObservabilityStore()


# =========================================================
# APPLICATION METRICS
# =========================================================

REQUEST_COUNT = Counter(
    "app_request_count",
    "Total number of HTTP requests"
)

ERROR_COUNT = Counter(
    "app_error_count",
    "Total number of HTTP errors"
)

REQUEST_LATENCY = Histogram(
    "app_request_latency_seconds",
    "HTTP request latency in seconds"
)

CURRENT_LATENCY = Gauge(
    "app_current_latency_seconds",
    "Latest HTTP request latency in seconds"
)

ERROR_RATE = Gauge(
    "app_error_rate",
    "Current HTTP error rate"
)


# =========================================================
# ENDPOINT-WISE APPLICATION METRICS
# =========================================================

ENDPOINT_REQUEST_COUNT = Counter(
    "app_endpoint_request_count",
    "Total HTTP requests by endpoint",
    ["method", "endpoint"]
)


ENDPOINT_ERROR_COUNT = Counter(
    "app_endpoint_error_count",
    "Total HTTP errors by endpoint",
    ["method", "endpoint"]
)


ENDPOINT_LATENCY = Histogram(
    "app_endpoint_latency_seconds",
    "HTTP request latency by endpoint",
    ["method", "endpoint"]
)


ENDPOINT_CURRENT_LATENCY = Gauge(
    "app_endpoint_current_latency_seconds",
    "Latest HTTP request latency by endpoint",
    ["method", "endpoint"]
)


# =========================================================
# RUNTIME ENDPOINT STATISTICS
# =========================================================

endpoint_runtime = {}

endpoint_runtime_lock = threading.Lock()


MONITORING_EXCLUDED_ENDPOINTS = {
    "/metrics",
    "/application-monitoring",
    "/application-monitoring/endpoints",
}


def should_track_runtime_endpoint(endpoint: str) -> bool:
    """Avoid letting the APM's own read APIs distort application telemetry."""

    return (
        endpoint not in MONITORING_EXCLUDED_ENDPOINTS
        and not endpoint.startswith("/observability")
        and endpoint not in {"/docs", "/openapi.json", "/redoc"}
    )


# =========================================================
# SYSTEM METRICS
# =========================================================

SYSTEM_CPU_USAGE = Gauge(
    "system_cpu_usage_percent",
    "Current system CPU usage percentage"
)


SYSTEM_MEMORY_USAGE = Gauge(
    "system_memory_usage_percent",
    "Current system memory usage percentage"
)

# Prometheus gauges begin at zero. Do not analyze them until a collector
# has supplied the first complete CPU/memory sample.
SYSTEM_METRICS_READY = threading.Event()


# =========================================================
# AI METRICS
# =========================================================

AI_ANOMALY = Gauge(
    "ai_anomaly",
    "AI anomaly status: 1=anomaly, 0=normal"
)


AI_ANOMALY_SCORE = Gauge(
    "ai_anomaly_score",
    "AI anomaly score"
)


AI_RISK_SCORE = Gauge(
    "ai_risk_score",
    "Predictive AI risk score"
)


AI_RISK_LEVEL = Gauge(
    "ai_risk_level",
    "AI risk level: 0=LOW, 1=MEDIUM, 2=HIGH"
)


# =========================================================
# SELF-HEALING METRICS
# =========================================================

SELF_HEALING_STATUS = Gauge(
    "self_healing_status",
    "Self-healing status: 0=not required, 1=recommendation, 2=executed"
)


SELF_HEALING_ACTION = Gauge(
    "self_healing_action",
    "Self-healing action executed: 0=no, 1=yes"
)


SELF_HEALING_COUNT = Gauge(
    "self_healing_count",
    "Total self-healing operations"
)


SELF_HEALING_SUCCESS = Gauge(
    "self_healing_success",
    "Successful self-healing operations"
)


SELF_HEALING_FAILURE = Gauge(
    "self_healing_failure",
    "Failed self-healing operations"
)


# =========================================================
# INCIDENT METRICS
# =========================================================

INCIDENT_OPEN = Gauge(
    "incident_open",
    "Number of currently open incidents"
)


INCIDENT_TOTAL = Gauge(
    "incident_total",
    "Total number of incidents"
)


INCIDENT_RESOLVED = Gauge(
    "incident_resolved",
    "Number of resolved incidents"
)


INCIDENT_ESCALATED = Gauge(
    "incident_escalated",
    "Number of escalated incidents"
)


# =========================================================
# APM AGENT METRICS
# =========================================================

AGENT_ONLINE = Gauge(
    "apm_agent_online",
    "APM agent online status: 1=online, 0=offline"
)


AGENT_CPU_USAGE = Gauge(
    "apm_agent_cpu_usage_percent",
    "CPU usage reported by APM agent"
)


AGENT_MEMORY_USAGE = Gauge(
    "apm_agent_memory_usage_percent",
    "Memory usage reported by APM agent"
)


AGENT_DISK_USAGE = Gauge(
    "apm_agent_disk_usage_percent",
    "Disk usage reported by APM agent"
)


AGENT_UPTIME = Gauge(
    "apm_agent_uptime_seconds",
    "Agent uptime in seconds"
)


AGENT_LAST_HEARTBEAT = Gauge(
    "apm_agent_last_heartbeat_timestamp",
    "Unix timestamp of last agent heartbeat"
)


# =========================================================
# APM AGENT STATE
# =========================================================

agent_state = {
    "agent_name": None,
    "hostname": None,
    "platform": None,
    "platform_version": None,
    "status": "OFFLINE",
    "last_heartbeat": None,
    "last_metrics": None,
}


# =========================================================
# AGENT DEPLOYMENT STATE
# =========================================================

deployment_state = {
    "deployments": {}
}


deployment_state_lock = threading.Lock()


# =========================================================
# REQUEST MODELS FOR AGENT
# =========================================================

class AgentMetrics(BaseModel):

    agent_name: str

    hostname: str

    platform: str | None = None

    platform_version: str | None = None

    cpu_usage_percent: float

    memory_usage_percent: float

    memory_total_mb: float | None = None

    memory_available_mb: float | None = None

    disk_usage_percent: float | None = None

    uptime_seconds: float | None = None

    processes: list[dict] = Field(
        default_factory=list
    )

    process_count: int = 0

    timestamp: str | None = None


class AgentHeartbeat(BaseModel):

    agent_name: str

    hostname: str

    status: str = "ONLINE"

    timestamp: str | None = None


# =========================================================
# AGENT DEPLOYMENT REQUEST
# =========================================================

class AgentDeploymentRequest(BaseModel):

    agent_name: str = Field(
        default="AI-Predictive-APM-Agent",
        min_length=1,
        max_length=100
    )

    operating_system: str = Field(
        default="Windows",
        min_length=1,
        max_length=50
    )

    backend_url: str = Field(
        default="http://127.0.0.1:8001",
        min_length=1,
        max_length=500
    )

    collection_interval: int = Field(
        default=5,
        ge=1,
        le=3600
    )


# =========================================================
# SERVICE TELEMETRY REQUEST MODELS
# =========================================================

class ServiceTelemetryMetrics(BaseModel):

    request_count: int = Field(default=0, ge=0)

    error_count: int = Field(default=0, ge=0)

    response_time_ms: float | None = Field(default=None, ge=0)

    cpu_usage_percent: float | None = Field(
        default=None,
        ge=0,
        le=100
    )

    memory_usage_percent: float | None = Field(
        default=None,
        ge=0,
        le=100
    )


class ServiceDependency(BaseModel):

    service_name: str = Field(min_length=1, max_length=120)

    service_type: str = Field(default="service", max_length=80)

    environment: str | None = Field(default=None, max_length=80)


class TraceSpan(BaseModel):

    trace_id: str | None = Field(default=None, max_length=128)

    span_id: str | None = Field(default=None, max_length=128)

    parent_span_id: str | None = Field(default=None, max_length=128)

    operation: str = Field(default="request", max_length=255)

    duration_ms: float | None = Field(default=None, ge=0)

    status: str = Field(default="OK", max_length=32)


class ServiceTelemetryIngest(BaseModel):

    service_name: str = Field(min_length=1, max_length=120)

    service_type: str = Field(default="service", max_length=80)

    environment: str = Field(default="default", max_length=80)

    hostname: str | None = Field(default=None, max_length=255)

    timestamp: str | None = None

    metrics: ServiceTelemetryMetrics

    dependencies: list[ServiceDependency] = Field(default_factory=list)

    attributes: dict[str, str] = Field(default_factory=dict)

    trace: TraceSpan | None = None


# =========================================================
# AUTOMATIC SYSTEM MONITORING
# =========================================================

def require_system_metrics():
    if not SYSTEM_METRICS_READY.is_set():
        raise HTTPException(
            status_code=503,
            detail="Waiting for the first system metrics sample. Please retry shortly."
        )


def update_system_metrics():

    while True:

        try:

            cpu_usage = psutil.cpu_percent(
                interval=0.1
            )

            memory_usage = (
                psutil.virtual_memory().percent
            )

            SYSTEM_CPU_USAGE.set(
                cpu_usage
            )

            SYSTEM_MEMORY_USAGE.set(
                memory_usage
            )

            SYSTEM_METRICS_READY.set()

        except Exception as e:

            print(
                f"[SYSTEM MONITORING ERROR] {e}"
            )

        time.sleep(5)


# =========================================================
# ERROR RATE
# =========================================================

def get_error_rate():

    total_requests = (
        REQUEST_COUNT._value.get()
    )

    total_errors = (
        ERROR_COUNT._value.get()
    )

    if total_requests == 0:

        ERROR_RATE.set(0)

        return 0.0

    error_rate = (
        total_errors /
        total_requests
    ) * 100

    ERROR_RATE.set(
        error_rate
    )

    return error_rate


# =========================================================
# ENDPOINT METRICS HELPER
# =========================================================

def get_endpoint_metrics():

    endpoints = {}

    # -----------------------------------------------------
    # REQUEST COUNTS
    # -----------------------------------------------------

    for metric in ENDPOINT_REQUEST_COUNT.collect():

        for sample in metric.samples:

            if sample.name.endswith("_total"):

                method = sample.labels.get(
                    "method",
                    "UNKNOWN"
                )

                endpoint = sample.labels.get(
                    "endpoint",
                    "UNKNOWN"
                )

                key = f"{method} {endpoint}"

                endpoints.setdefault(
                    key,
                    {
                        "method": method,
                        "endpoint": endpoint,
                        "requests": 0,
                        "errors": 0,
                        "latency_seconds": 0
                    }
                )

                endpoints[key]["requests"] = (
                    sample.value
                )

    # -----------------------------------------------------
    # ERROR COUNTS
    # -----------------------------------------------------

    for metric in ENDPOINT_ERROR_COUNT.collect():

        for sample in metric.samples:

            if sample.name.endswith("_total"):

                method = sample.labels.get(
                    "method",
                    "UNKNOWN"
                )

                endpoint = sample.labels.get(
                    "endpoint",
                    "UNKNOWN"
                )

                key = f"{method} {endpoint}"

                endpoints.setdefault(
                    key,
                    {
                        "method": method,
                        "endpoint": endpoint,
                        "requests": 0,
                        "errors": 0,
                        "latency_seconds": 0
                    }
                )

                endpoints[key]["errors"] = (
                    sample.value
                )

    # -----------------------------------------------------
    # CURRENT LATENCY
    # -----------------------------------------------------

    for metric in ENDPOINT_CURRENT_LATENCY.collect():

        for sample in metric.samples:

            method = sample.labels.get(
                "method",
                "UNKNOWN"
            )

            endpoint = sample.labels.get(
                "endpoint",
                "UNKNOWN"
            )

            key = f"{method} {endpoint}"

            endpoints.setdefault(
                key,
                {
                    "method": method,
                    "endpoint": endpoint,
                    "requests": 0,
                    "errors": 0,
                    "latency_seconds": 0
                }
            )

            endpoints[key]["latency_seconds"] = (
                round(sample.value, 4)
            )

    # -----------------------------------------------------
    # CALCULATE ERROR RATE
    # -----------------------------------------------------

    result = []

    for data in endpoints.values():

        requests = data["requests"]

        errors = data["errors"]

        if requests > 0:

            error_rate = (
                errors / requests
            ) * 100

        else:

            error_rate = 0

        result.append(
            {
                "method": data["method"],
                "endpoint": data["endpoint"],
                "requests": int(data["requests"]),
                "errors": int(data["errors"]),
                "error_rate_percent": round(
                    error_rate,
                    2
                ),
                "latency_seconds": round(
                    data["latency_seconds"],
                    4
                )
            }
        )

    result.sort(
        key=lambda x: x["requests"],
        reverse=True
    )

    return result


# =========================================================
# INCIDENT METRICS
# =========================================================

def update_incident_metrics():

    incidents = (
        incident_manager.get_incidents()
    )

    open_count = sum(
        1
        for incident in incidents
        if incident["status"] == "OPEN"
    )

    resolved_count = sum(
        1
        for incident in incidents
        if incident["status"] == "RESOLVED"
    )

    escalated_count = sum(
        1
        for incident in incidents
        if incident["status"] == "ESCALATED"
    )

    INCIDENT_OPEN.set(
        open_count
    )

    INCIDENT_TOTAL.set(
        len(incidents)
    )

    INCIDENT_RESOLVED.set(
        resolved_count
    )

    INCIDENT_ESCALATED.set(
        escalated_count
    )


# =========================================================
# AGENT DEPLOYMENT HELPERS
# =========================================================

def validate_backend_url(url: str):
    try:
        return validate_url(url)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


def create_agent_deployment(deployment_id: str, agent_name: str,
                            operating_system: str, backend_url: str,
                            collection_interval: int):
    try:
        return build_installer(PROJECT_ROOT, deployment_id, agent_name,
                               operating_system, backend_url, collection_interval)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except InstallerBuildError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


# =========================================================
# TRAIN AI MODEL
# =========================================================

@app.on_event("startup")
def train_ai_model():

    try:

        data = pd.read_csv(
            "ai/training_data.csv"
        )

        required_features = [
            "cpu",
            "memory",
            "latency",
            "error_rate"
        ]

        missing = [
            feature
            for feature in required_features
            if feature not in data.columns
        ]

        if missing:

            print(
                f"ERROR: Missing training features: {missing}"
            )

            return

        features = data[
            required_features
        ]

        ml_model.train(
            features
        )

        print(
            "AI anomaly detection model trained successfully!"
        )

    except Exception as e:

        print(
            f"AI model training error: {e}"
        )


# =========================================================
# START SYSTEM MONITORING
# =========================================================

@app.on_event("startup")
def start_monitoring():

    monitoring_thread = threading.Thread(
        target=update_system_metrics,
        daemon=True
    )

    monitoring_thread.start()

    print(
        "Automatic system monitoring started!"
    )


# =========================================================
# AUTOMATIC SELF-HEALING + INCIDENT MONITOR
# =========================================================

def automatic_self_healing():

    print(
        "Automatic self-healing monitor started!"
    )

    while True:

        if not SYSTEM_METRICS_READY.wait(timeout=5):
            continue

        try:

            cpu = (
                SYSTEM_CPU_USAGE._value.get()
            )

            memory = (
                SYSTEM_MEMORY_USAGE._value.get()
            )

            latency = (
                CURRENT_LATENCY._value.get()
            )

            error_rate = get_error_rate()

            # =================================================
            # ML ANOMALY DETECTION
            # =================================================

            result = ml_model.predict(
                cpu,
                memory,
                latency,
                error_rate
            )

            # =================================================
            # UPDATE AI METRICS
            # =================================================

            AI_ANOMALY.set(
                1 if result["anomaly"] else 0
            )

            AI_ANOMALY_SCORE.set(
                result["score"]
            )

            # =================================================
            # ONLY ACT ON ANOMALY
            # =================================================

            if result["anomaly"]:

                print(
                    f"[AI] Anomaly detected | "
                    f"CPU={cpu:.2f}% | "
                    f"Memory={memory:.2f}% | "
                    f"Latency={latency:.4f}s | "
                    f"Error Rate={error_rate:.2f}%"
                )

                # =============================================
                # ROOT CAUSE
                # =============================================

                analysis = (
                    root_cause_analyzer.analyze(
                        cpu,
                        memory,
                        latency,
                        error_rate,
                        result["anomaly"]
                    )
                )

                # =============================================
                # PREDICTIVE RISK
                # =============================================

                prediction = (
                    predictive_engine.predict_risk(
                        cpu,
                        memory,
                        latency,
                        error_rate
                    )
                )

                AI_RISK_SCORE.set(
                    prediction["risk_score"]
                )

                risk = prediction["risk"]

                if risk == "LOW":

                    AI_RISK_LEVEL.set(0)

                elif risk == "MEDIUM":

                    AI_RISK_LEVEL.set(1)

                elif risk == "HIGH":

                    AI_RISK_LEVEL.set(2)

                # =============================================
                # CREATE INCIDENT
                # =============================================

                existing_open = (
                    incident_manager.get_open_incidents()
                )

                if not existing_open:

                    if risk == "HIGH":

                        severity = "CRITICAL"

                    elif risk == "MEDIUM":

                        severity = "WARNING"

                    else:

                        severity = "INFO"

                    if analysis["problems"]:

                        problem = (
                            analysis["problems"][0]
                        )

                    else:

                        problem = (
                            "Application performance anomaly"
                        )

                    incident_manager.create_incident(

                        severity=severity,

                        problem=problem,

                        root_cause=(
                            analysis["problems"]
                        ),

                        risk=risk,

                        cpu=cpu,

                        memory=memory,

                        latency=latency,

                        error_rate=error_rate
                    )

                    update_incident_metrics()

                # =============================================
                # SELF-HEALING
                # =============================================

                healing = (
                    self_healing_engine.heal(

                        cpu=cpu,

                        memory=memory,

                        latency=latency,

                        error_rate=error_rate,

                        anomaly=result["anomaly"],

                        root_cause=(
                            analysis["problems"]
                        ),

                        risk=risk
                    )
                )

                # =============================================
                # SELF-HEALING METRICS
                # =============================================

                if (
                    healing["status"]
                    == "ACTION_EXECUTED"
                ):

                    SELF_HEALING_STATUS.set(2)

                    SELF_HEALING_ACTION.set(1)

                elif (
                    healing["status"]
                    == "ACTION_FAILED"
                ):

                    SELF_HEALING_STATUS.set(0)

                    SELF_HEALING_ACTION.set(0)

                elif (
                    healing["status"]
                    == "RECOMMENDATION"
                ):

                    SELF_HEALING_STATUS.set(1)

                    SELF_HEALING_ACTION.set(0)

                else:

                    SELF_HEALING_STATUS.set(0)

                    SELF_HEALING_ACTION.set(0)

                SELF_HEALING_COUNT.set(
                    self_healing_engine.healing_count
                )

                SELF_HEALING_SUCCESS.set(
                    self_healing_engine.success_count
                )

                SELF_HEALING_FAILURE.set(
                    self_healing_engine.failure_count
                )

                print(
                    f"[SELF-HEALING] "
                    f"Status={healing['status']} | "
                    f"Action={healing['action']}"
                )

        except Exception as e:

            print(
                f"[SELF-HEALING ERROR] {e}"
            )

        time.sleep(10)


# =========================================================
# START AUTOMATIC SELF-HEALING
# =========================================================

@app.on_event("startup")
def start_self_healing():

    healing_thread = threading.Thread(
        target=automatic_self_healing,
        daemon=True
    )

    healing_thread.start()

    print(
        "Automatic self-healing engine started!"
    )


# =========================================================
# REQUEST MONITORING MIDDLEWARE
# =========================================================

@app.middleware("http")
async def monitor_requests(
    request: Request,
    call_next
):

    start_time = time.time()

    method = request.method

    endpoint = request.url.path

    status_code = 500

    try:

        response = await call_next(request)

        status_code = response.status_code

        # -----------------------------------------------------
        # Get FastAPI route template
        # -----------------------------------------------------

        route = request.scope.get(
            "route"
        )

        if route is not None:

            route_path = getattr(
                route,
                "path",
                None
            )

            if route_path:

                endpoint = route_path

        # -----------------------------------------------------
        # Global metrics
        # -----------------------------------------------------

        REQUEST_COUNT.inc()

        if status_code >= 400:

            ERROR_COUNT.inc()

        # -----------------------------------------------------
        # Endpoint metrics
        # -----------------------------------------------------

        if should_track_runtime_endpoint(endpoint):

            ENDPOINT_REQUEST_COUNT.labels(
                method=method,
                endpoint=endpoint
            ).inc()

            if status_code >= 400:

                ENDPOINT_ERROR_COUNT.labels(
                    method=method,
                    endpoint=endpoint
                ).inc()

        return response

    except Exception:

        REQUEST_COUNT.inc()

        ERROR_COUNT.inc()

        if should_track_runtime_endpoint(endpoint):

            ENDPOINT_REQUEST_COUNT.labels(
                method=method,
                endpoint=endpoint
            ).inc()

            ENDPOINT_ERROR_COUNT.labels(
                method=method,
                endpoint=endpoint
            ).inc()

        raise

    finally:

        duration = (
            time.time()
            - start_time
        )

        # -----------------------------------------------------
        # Global latency
        # -----------------------------------------------------

        REQUEST_LATENCY.observe(
            duration
        )

        CURRENT_LATENCY.set(
            duration
        )

        # -----------------------------------------------------
        # Endpoint latency
        # -----------------------------------------------------

        if should_track_runtime_endpoint(endpoint):

            ENDPOINT_LATENCY.labels(
                method=method,
                endpoint=endpoint
            ).observe(
                duration
            )

            ENDPOINT_CURRENT_LATENCY.labels(
                method=method,
                endpoint=endpoint
            ).set(
                duration
            )

            # -------------------------------------------------
            # Runtime statistics
            # -------------------------------------------------

            with endpoint_runtime_lock:

                key = (
                    method,
                    endpoint
                )

                if key not in endpoint_runtime:

                    endpoint_runtime[key] = {

                        "method":
                            method,

                        "endpoint":
                            endpoint,

                        "requests":
                            0,

                        "errors":
                            0,

                        "latency_total_seconds":
                            0.0,

                        "last_latency_seconds":
                            0.0,
                    }

                item = (
                    endpoint_runtime[key]
                )

                item["requests"] += 1

                if status_code >= 400:

                    item["errors"] += 1

                item[
                    "latency_total_seconds"
                ] += duration

                item[
                    "last_latency_seconds"
                ] = duration

        # -----------------------------------------------------
        # Service telemetry and trace intake
        # -----------------------------------------------------

        if should_track_runtime_endpoint(endpoint):

            try:

                observability_store.record_http_request(
                    endpoint=endpoint,
                    method=method,
                    status_code=status_code,
                    duration_seconds=duration,
                    hostname=socket.gethostname()
                )

            except Exception as error:

                # Observability must never interrupt the monitored workload.
                print(f"[OBSERVABILITY ERROR] {error}")


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {

        "message":
            "AI-Powered Predictive APM is running",

        "status":
            "healthy",

        "agent":
            agent_state["status"]

    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health_check():

    return {

        "status":
            "healthy",

        "agent_status":
            agent_state["status"]

    }


# =========================================================
# SERVICE OBSERVABILITY
# =========================================================

@app.post("/observability/telemetry", status_code=202)
def ingest_service_telemetry(
    payload: ServiceTelemetryIngest
):

    service = observability_store.ingest(
        payload.model_dump()
    )

    return {
        "status": "accepted",
        "service": service
    }


@app.get("/observability/overview")
def observability_overview():

    return observability_store.overview()


@app.get("/observability/services")
def observability_services():

    services = observability_store.services()

    return {
        "count": len(services),
        "services": services
    }


@app.get("/observability/services/{service_id}")
def observability_service(
    service_id: str
):

    service = observability_store.service(
        service_id
    )

    if service is None:

        raise HTTPException(
            status_code=404,
            detail="Service not found"
        )

    return service


@app.get("/observability/services/{service_id}/timeseries")
def observability_service_timeseries(
    service_id: str,
    limit: int = 60
):

    points = observability_store.timeseries(
        service_id=service_id,
        limit=limit
    )

    if points is None:

        raise HTTPException(
            status_code=404,
            detail="Service not found"
        )

    return {
        "service_id": service_id,
        "count": len(points),
        "points": points
    }


@app.get("/observability/topology")
def observability_topology():

    return observability_store.topology()


@app.get("/observability/alerts")
def observability_alerts():

    alerts = observability_store.alerts()

    return {
        "count": len(alerts),
        "alerts": alerts
    }


@app.get("/observability/traces")
def observability_traces(
    limit: int = 50
):

    traces = observability_store.traces(
        limit=limit
    )

    return {
        "count": len(traces),
        "traces": traces
    }


# =========================================================
# SYSTEM METRICS
# =========================================================

@app.get("/system-metrics")
def system_metrics():

    require_system_metrics()

    return {

        "cpu_usage_percent":
            SYSTEM_CPU_USAGE._value.get(),

        "memory_usage_percent":
            SYSTEM_MEMORY_USAGE._value.get(),

        "latency_seconds":
            CURRENT_LATENCY._value.get(),

        "error_rate_percent":
            get_error_rate()

    }


# =========================================================
# APPLICATION MONITORING
# =========================================================

@app.get("/application-monitoring")
def application_monitoring():

    total_requests = (
        REQUEST_COUNT._value.get()
    )

    total_errors = (
        ERROR_COUNT._value.get()
    )

    current_latency = (
        CURRENT_LATENCY._value.get()
    )

    error_rate = get_error_rate()

    # -----------------------------------------------------
    # APPLICATION HEALTH SCORE
    # -----------------------------------------------------

    health_score = 100

    if error_rate > 5:

        health_score -= 30

    elif error_rate > 1:

        health_score -= 15

    if current_latency > 2:

        health_score -= 30

    elif current_latency > 1:

        health_score -= 15

    if health_score >= 80:

        health_status = "HEALTHY"

    elif health_score >= 50:

        health_status = "WARNING"

    else:

        health_status = "CRITICAL"

    return {

        "application":
            "AI-Powered Predictive APM",

        "health": {

            "status":
                health_status,

            "score":
                max(
                    0,
                    health_score
                )

        },

        "requests": {

            "total":
                int(total_requests),

            "errors":
                int(total_errors),

            "error_rate_percent":
                round(
                    error_rate,
                    2
                )

        },

        "performance": {

            "current_latency_seconds":
                round(
                    current_latency,
                    4
                )

        },

        "ai_integration": {

            "anomaly":
                AI_ANOMALY._value.get(),

            "anomaly_score":
                AI_ANOMALY_SCORE._value.get(),

            "risk_score":
                AI_RISK_SCORE._value.get()

        },

        "agent": {

            "status":
                agent_state["status"]

        }

    }


# =========================================================
# APPLICATION - ENDPOINT MONITORING
# =========================================================

@app.get("/application/endpoints")
def application_endpoints():

    endpoints = get_endpoint_metrics()

    return {

        "total_endpoints":
            len(endpoints),

        "endpoints":
            endpoints

    }


# =========================================================
# APPLICATION - SLOW ENDPOINTS
# =========================================================

@app.get("/application/slow-endpoints")
def application_slow_endpoints():

    endpoints = get_endpoint_metrics()

    endpoints.sort(
        key=lambda x: x["latency_seconds"],
        reverse=True
    )

    return {

        "total_endpoints":
            len(endpoints),

        "slow_endpoints":
            endpoints

    }


# =========================================================
# APPLICATION - ERROR ENDPOINTS
# =========================================================

@app.get("/application/error-endpoints")
def application_error_endpoints():

    endpoints = get_endpoint_metrics()

    error_endpoints = [
        endpoint
        for endpoint in endpoints
        if endpoint["errors"] > 0
    ]

    error_endpoints.sort(
        key=lambda x: x["error_rate_percent"],
        reverse=True
    )

    return {

        "total_error_endpoints":
            len(error_endpoints),

        "error_endpoints":
            error_endpoints

    }


# =========================================================
# APPLICATION MONITORING ENDPOINT RUNTIME
# =========================================================

@app.get("/application-monitoring/endpoints")
def application_monitoring_endpoints():

    with endpoint_runtime_lock:

        rows = []

        for item in endpoint_runtime.values():

            requests = item["requests"]

            errors = item["errors"]

            error_rate = (
                (errors / requests) * 100
                if requests > 0
                else 0
            )

            average_latency = (
                item["latency_total_seconds"]
                / requests
                if requests > 0
                else 0
            )

            rows.append({

                "method":
                    item["method"],

                "endpoint":
                    item["endpoint"],

                "requests":
                    requests,

                "errors":
                    errors,

                "error_rate_percent":
                    round(
                        error_rate,
                        2
                    ),

                "average_latency_seconds":
                    round(
                        average_latency,
                        4
                    ),

                "last_latency_seconds":
                    round(
                        item["last_latency_seconds"],
                        4
                    ),
            })

    rows.sort(
        key=lambda x: x["requests"],
        reverse=True
    )

    return {

        "endpoints":
            rows,

        "count":
            len(rows)

    }


# =========================================================
# PROMETHEUS METRICS
# =========================================================

@app.get("/metrics")
def metrics():

    return Response(

        generate_latest(),

        media_type=CONTENT_TYPE_LATEST

    )


# =========================================================
# APM AGENT - RECEIVE METRICS
# =========================================================

@app.post("/agent/metrics")
def receive_agent_metrics(
    data: AgentMetrics
):

    # -----------------------------------------------------
    # Save agent information
    # -----------------------------------------------------

    agent_state["agent_name"] = (
        data.agent_name
    )

    agent_state["hostname"] = (
        data.hostname
    )

    agent_state["platform"] = (
        data.platform
    )

    agent_state["platform_version"] = (
        data.platform_version
    )

    agent_state["status"] = "ONLINE"

    # -----------------------------------------------------
    # Save latest metrics
    # -----------------------------------------------------

    agent_state["last_metrics"] = (
        data.model_dump()
    )

    # -----------------------------------------------------
    # Update Prometheus
    # -----------------------------------------------------

    AGENT_ONLINE.set(1)

    AGENT_CPU_USAGE.set(
        data.cpu_usage_percent
    )

    AGENT_MEMORY_USAGE.set(
        data.memory_usage_percent
    )

    if data.disk_usage_percent is not None:

        AGENT_DISK_USAGE.set(
            data.disk_usage_percent
        )

    if data.uptime_seconds is not None:

        AGENT_UPTIME.set(
            data.uptime_seconds
        )

    # -----------------------------------------------------
    # Agent metrics update system metrics
    # -----------------------------------------------------

    SYSTEM_CPU_USAGE.set(
        data.cpu_usage_percent
    )

    SYSTEM_MEMORY_USAGE.set(
        data.memory_usage_percent
    )

    SYSTEM_METRICS_READY.set()

    # -----------------------------------------------------
    # Heartbeat
    # -----------------------------------------------------

    now = time.time()

    agent_state["last_heartbeat"] = now

    AGENT_LAST_HEARTBEAT.set(
        now
    )

    # -----------------------------------------------------
    # Feed host telemetry into the service model
    # -----------------------------------------------------

    try:

        observability_store.ingest({

            "service_name": data.hostname,

            "service_type": "host",

            "environment": "default",

            "hostname": data.hostname,

            "timestamp": data.timestamp,

            "metrics": {

                "request_count": 0,

                "error_count": 0,

                "cpu_usage_percent": data.cpu_usage_percent,

                "memory_usage_percent": data.memory_usage_percent

            },

            "attributes": {

                "agent.name": data.agent_name,

                "os.name": data.platform or "unknown"

            }

        })

    except Exception as error:

        print(f"[OBSERVABILITY ERROR] {error}")

    # -----------------------------------------------------
    # Log
    # -----------------------------------------------------

    print(
        f"[AGENT] Metrics received | "
        f"Agent={data.agent_name} | "
        f"Host={data.hostname} | "
        f"CPU={data.cpu_usage_percent:.2f}% | "
        f"Memory={data.memory_usage_percent:.2f}% | "
        f"Processes={len(data.processes)}"
    )

    return {

        "status":
            "success",

        "message":
            "Agent metrics received",

        "agent_name":
            data.agent_name,

        "hostname":
            data.hostname,

        "cpu_usage_percent":
            data.cpu_usage_percent,

        "memory_usage_percent":
            data.memory_usage_percent,

        "process_count":
            len(data.processes),

        "timestamp":
            now

    }


# =========================================================
# APM AGENT - HEARTBEAT
# =========================================================

@app.post("/agent/heartbeat")
def receive_agent_heartbeat(
    data: AgentHeartbeat
):

    now = time.time()

    agent_state["agent_name"] = (
        data.agent_name
    )

    agent_state["hostname"] = (
        data.hostname
    )

    agent_state["status"] = "ONLINE"

    agent_state["last_heartbeat"] = now

    AGENT_ONLINE.set(1)

    AGENT_LAST_HEARTBEAT.set(
        now
    )

    print(
        f"[AGENT] Heartbeat received | "
        f"Agent={data.agent_name} | "
        f"Host={data.hostname}"
    )

    return {

        "status":
            "success",

        "agent_status":
            "ONLINE",

        "agent_name":
            data.agent_name,

        "hostname":
            data.hostname,

        "timestamp":
            now

    }


# =========================================================
# APM AGENT - STATUS
# =========================================================

@app.get("/agent/status")
def agent_status():

    """
    Return the current monitoring agent status.

    Agent is ONLINE when a heartbeat was received
    within the last 15 seconds.
    """

    now = time.time()

    last_heartbeat = (
        agent_state.get(
            "last_heartbeat"
        )
    )

    if last_heartbeat is not None:

        heartbeat_age = (
            now - last_heartbeat
        )

        is_online = (
            heartbeat_age <= 15
        )

    else:

        heartbeat_age = None

        is_online = False

    # -----------------------------------------------------
    # Keep Prometheus synchronized
    # -----------------------------------------------------

    if is_online:

        AGENT_ONLINE.set(1)

    else:

        AGENT_ONLINE.set(0)

    return {

        "status":
            "ONLINE"
            if is_online
            else "OFFLINE",

        "agent_name":
            agent_state.get(
                "agent_name"
            ),

        "hostname":
            agent_state.get(
                "hostname"
            ),

        "platform":
            agent_state.get(
                "platform"
            ),

        "platform_version":
            agent_state.get(
                "platform_version"
            ),

        "last_heartbeat":
            last_heartbeat,

        "heartbeat_age_seconds":
            (
                round(
                    heartbeat_age,
                    2
                )
                if heartbeat_age is not None
                else None
            ),

        "last_metrics":
            agent_state.get(
                "last_metrics"
            )

    }


# =========================================================
# APM AGENT - PROCESS MONITORING
# =========================================================

@app.get("/agent/processes")
def agent_processes():

    last_metrics = (
        agent_state.get(
            "last_metrics"
        )
        or {}
    )

    processes = (
        last_metrics.get(
            "processes"
        )
        or []
    )

    return {

        "agent_name":
            agent_state.get(
                "agent_name"
            ),

        "hostname":
            agent_state.get(
                "hostname"
            ),

        "status":
            agent_state.get(
                "status"
            ),

        "count":
            len(processes),

        "timestamp":
            last_metrics.get(
                "timestamp"
            ),

        "processes":
            processes

    }


# =========================================================
# AGENT DEPLOYMENT
# =========================================================

@app.post("/agent/deploy")
def deploy_agent(
    request: AgentDeploymentRequest
):

    backend_url = validate_backend_url(
        request.backend_url
    )

    deployment_id = (
        uuid.uuid4().hex
    )

    created_at = (
        datetime.now(
            timezone.utc
        ).isoformat()
    )

    try:

        deployment = create_agent_deployment(

            deployment_id=
                deployment_id,

            agent_name=
                request.agent_name,

            operating_system=
                request.operating_system,

            backend_url=
                backend_url,

            collection_interval=
                request.collection_interval
        )

    except HTTPException:

        raise

    except Exception as e:

        print(
            f"[AGENT DEPLOYMENT ERROR] {e}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to create agent deployment package."
            )
        )

    deployment["created_at"] = (
        created_at
    )

    with deployment_state_lock:

        deployment_state[
            "deployments"
        ][deployment_id] = deployment

    print(
        f"[AGENT DEPLOYMENT] Package created | "
        f"ID={deployment_id} | "
        f"Agent={request.agent_name}"
    )

    return {

        "status":
            "success",

        "message":
            "Windows installer created successfully.",

        "deployment":
            deployment

    }


# =========================================================
# AGENT DEPLOYMENT STATUS
# =========================================================

@app.get("/agent/deployment/status")
def agent_deployment_status():

    with deployment_state_lock:

        deployments = list(
            deployment_state[
                "deployments"
            ].values()
        )

    deployments.sort(
        key=lambda x: x.get(
            "created_at",
            ""
        ),
        reverse=True
    )

    return {

        "status":
            "success",

        "count":
            len(deployments),

        "deployments":
            deployments

    }


# =========================================================
# AGENT DEPLOYMENT DOWNLOAD
# =========================================================

@app.get(
    "/agent/deployment/download/{deployment_id}"
)
def download_agent_deployment(
    deployment_id: str
):

    try:
        deployment = load_deployment(PROJECT_ROOT, deployment_id)
    except ValueError:
        deployment = None
    if deployment is None:
        raise HTTPException(status_code=404, detail="Installer not found. Generate a new installer.")
    path = AGENT_GENERATED_DIR / deployment_id / deployment["package"]
    return FileResponse(path=str(path), media_type="application/octet-stream",
                        filename=deployment["package"],
                        headers={"X-Content-Type-Options": "nosniff",
                                 "X-Installer-SHA256": deployment["sha256"]})


# =========================================================
# AI ANALYSIS
# =========================================================

@app.get("/ai-analysis")
def ai_analysis():

    require_system_metrics()

    cpu = (
        SYSTEM_CPU_USAGE._value.get()
    )

    memory = (
        SYSTEM_MEMORY_USAGE._value.get()
    )

    latency = (
        CURRENT_LATENCY._value.get()
    )

    error_rate = get_error_rate()

    # =====================================================
    # ML ANOMALY
    # =====================================================

    result = ml_model.predict(

        cpu,

        memory,

        latency,

        error_rate

    )

    # =====================================================
    # ROOT CAUSE
    # =====================================================

    analysis = (
        root_cause_analyzer.analyze(

            cpu,

            memory,

            latency,

            error_rate,

            result["anomaly"]

        )
    )

    # =====================================================
    # PREDICTIVE RISK
    # =====================================================

    prediction = (
        predictive_engine.predict_risk(

            cpu,

            memory,

            latency,

            error_rate

        )
    )

    # =====================================================
    # UPDATE AI METRICS
    # =====================================================

    AI_ANOMALY.set(

        1
        if result["anomaly"]
        else 0

    )

    AI_ANOMALY_SCORE.set(

        result["score"]

    )

    AI_RISK_SCORE.set(

        prediction["risk_score"]

    )

    risk = prediction["risk"]

    if risk == "LOW":

        AI_RISK_LEVEL.set(0)

    elif risk == "MEDIUM":

        AI_RISK_LEVEL.set(1)

    elif risk == "HIGH":

        AI_RISK_LEVEL.set(2)

    return {

        "ai_status":
            result["status"],

        "anomaly":
            result["anomaly"],

        "anomaly_score":
            result["score"],

        "root_cause":
            analysis["problems"],

        "recommendations":
            analysis["recommendations"],

        "prediction":
            prediction,

        "metrics": {

            "cpu_usage_percent":
                cpu,

            "memory_usage_percent":
                memory,

            "latency_seconds":
                latency,

            "error_rate_percent":
                error_rate

        }

    }


# =========================================================
# SELF-HEALING
# =========================================================

@app.get("/self-healing")
def self_healing():

    require_system_metrics()

    cpu = (
        SYSTEM_CPU_USAGE._value.get()
    )

    memory = (
        SYSTEM_MEMORY_USAGE._value.get()
    )

    latency = (
        CURRENT_LATENCY._value.get()
    )

    error_rate = get_error_rate()

    # =====================================================
    # ML ANOMALY
    # =====================================================

    result = ml_model.predict(

        cpu,

        memory,

        latency,

        error_rate

    )

    # =====================================================
    # ROOT CAUSE
    # =====================================================

    analysis = (
        root_cause_analyzer.analyze(

            cpu,

            memory,

            latency,

            error_rate,

            result["anomaly"]

        )
    )

    # =====================================================
    # PREDICTIVE RISK
    # =====================================================

    prediction = (
        predictive_engine.predict_risk(

            cpu,

            memory,

            latency,

            error_rate

        )
    )

    # =====================================================
    # SELF-HEALING
    # =====================================================

    healing = (
        self_healing_engine.heal(

            cpu=cpu,

            memory=memory,

            latency=latency,

            error_rate=error_rate,

            anomaly=result["anomaly"],

            root_cause=(
                analysis["problems"]
            ),

            risk=prediction["risk"]

        )
    )

    # =====================================================
    # SELF-HEALING METRICS
    # =====================================================

    if (
        healing["status"]
        == "NOT_REQUIRED"
    ):

        SELF_HEALING_STATUS.set(0)

        SELF_HEALING_ACTION.set(0)

    elif (
        healing["status"]
        == "RECOMMENDATION"
    ):

        SELF_HEALING_STATUS.set(1)

        SELF_HEALING_ACTION.set(0)

    elif (
        healing["status"]
        == "ACTION_EXECUTED"
    ):

        SELF_HEALING_STATUS.set(2)

        SELF_HEALING_ACTION.set(1)

    elif (
        healing["status"]
        == "ACTION_FAILED"
    ):

        SELF_HEALING_STATUS.set(0)

        SELF_HEALING_ACTION.set(0)

    SELF_HEALING_COUNT.set(
        self_healing_engine.healing_count
    )

    SELF_HEALING_SUCCESS.set(
        self_healing_engine.success_count
    )

    SELF_HEALING_FAILURE.set(
        self_healing_engine.failure_count
    )

    # =====================================================
    # INCIDENT CREATION
    # =====================================================

    if result["anomaly"]:

        existing_open = (
            incident_manager.get_open_incidents()
        )

        if not existing_open:

            risk = prediction["risk"]

            if risk == "HIGH":

                severity = "CRITICAL"

            elif risk == "MEDIUM":

                severity = "WARNING"

            else:

                severity = "INFO"

            if analysis["problems"]:

                problem = (
                    analysis["problems"][0]
                )

            else:

                problem = (
                    "Application performance anomaly"
                )

            incident_manager.create_incident(

                severity=severity,

                problem=problem,

                root_cause=(
                    analysis["problems"]
                ),

                risk=risk,

                cpu=cpu,

                memory=memory,

                latency=latency,

                error_rate=error_rate

            )

            update_incident_metrics()

    return {

        "self_healing":
            healing,

        "ai_analysis": {

            "status":
                result["status"],

            "anomaly":
                result["anomaly"],

            "anomaly_score":
                result["score"],

            "root_cause":
                analysis["problems"],

            "recommendations":
                analysis["recommendations"],

            "prediction":
                prediction

        },

        "metrics": {

            "cpu_usage_percent":
                cpu,

            "memory_usage_percent":
                memory,

            "latency_seconds":
                latency,

            "error_rate_percent":
                error_rate

        }

    }


# =========================================================
# INCIDENT MANAGEMENT
# =========================================================

@app.get("/incidents")
def get_incidents():

    update_incident_metrics()

    return {

        "total_incidents":
            len(
                incident_manager.get_incidents()
            ),

        "open_incidents":
            len(
                incident_manager.get_open_incidents()
            ),

        "incidents":
            incident_manager.get_incidents()

    }


# =========================================================
# OPEN INCIDENTS
# =========================================================

@app.get("/incidents/open")
def get_open_incidents():

    update_incident_metrics()

    return {

        "open_incidents":
            incident_manager.get_open_incidents()

    }


# =========================================================
# INCIDENT BY ID
# =========================================================

@app.get("/incidents/{incident_id}")
def get_incident(
    incident_id: str
):

    incident = (
        incident_manager.get_incident(
            incident_id
        )
    )

    if incident is None:

        return {

            "error":
                "Incident not found"

        }

    return incident


# =========================================================
# FAILURE SIMULATION - HIGH CPU
# =========================================================

@app.get("/simulate/high-cpu")
def simulate_high_cpu():

    start_time = time.time()

    while (
        time.time() - start_time < 10
    ):

        _ = sum(
            i * i
            for i in range(100000)
        )

    return {

        "simulation":
            "HIGH_CPU",

        "status":
            "completed",

        "message":
            "CPU stress simulation completed"

    }


# =========================================================
# HIGH MEMORY SIMULATION
# =========================================================

@app.get("/simulate/high-memory")
def simulate_high_memory():

    temporary_data = []

    try:

        for _ in range(100):

            temporary_data.append(
                bytearray(
                    1024 * 1024
                )
            )

        memory_usage = (
            psutil.virtual_memory().percent
        )

        return {

            "simulation":
                "HIGH_MEMORY",

            "status":
                "completed",

            "memory_usage_percent":
                memory_usage,

            "message":
                "Memory stress simulation completed"

        }

    finally:

        del temporary_data


# =========================================================
# HIGH LATENCY SIMULATION
# =========================================================

@app.get("/simulate/high-latency")
def simulate_high_latency():

    delay = 5

    time.sleep(
        delay
    )

    return {

        "simulation":
            "HIGH_LATENCY",

        "status":
            "completed",

        "delay_seconds":
            delay,

        "message":
            "Latency simulation completed"

    }


# =========================================================
# ERROR SIMULATION
# =========================================================

@app.get("/simulate/error")
def simulate_error():

    raise RuntimeError(
        "Simulated application failure for APM testing"
    )
