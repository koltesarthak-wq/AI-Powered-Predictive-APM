# Predictive APM

Predictive APM is a local, Dynatrace-inspired observability application. It
combines host metrics from the Windows agent with service telemetry, topology,
traces, alerts, SLO health, anomaly analysis, and incident workflows.

## What is implemented

- Service telemetry intake at `POST /observability/telemetry`
- Service inventory, health scores, error rate, p95 latency, and availability SLO
- Dependency topology derived from submitted service dependencies
- Open alert detection for error rate, p95 latency, CPU, and memory
- Recent trace-span intake and display
- Automatic instrumentation of this FastAPI API as `predictive-apm-api`
- Host metrics from the existing agent added as host entities
- A **Service Flow** dashboard page with a local demo-traffic action

The in-memory telemetry store keeps the most recent 720 points per entity and
uses a 15-minute health window. This makes the project easy to run locally. For
a deployed product, retain the API contract and replace `app/observability.py`
with a durable time-series and trace backend.

## Run locally

The bundled startup files expect the API on port 8001. Create the Python
environment once before using them:

```powershell
cd C:\path\to\be-project
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

In a second terminal:

```powershell
cd C:\path\to\be-project\frontend
npm install
npm run dev
```

For a no-login UI preview with sample service data, open
`http://127.0.0.1:5173/preview.html`. This preview is separate from the
authenticated dashboard and does not require a running API.

Open the frontend URL shown by Vite, sign in, and choose **Service Flow**. The
**Add demo traffic** action creates a small web-store → checkout/catalog →
database topology to explore the views.

## Send real service telemetry

Send one point whenever a request, batch, or collection interval completes:

```json
{
  "service_name": "checkout-api",
  "service_type": "service",
  "environment": "production",
  "hostname": "checkout-01",
  "metrics": {
    "request_count": 25,
    "error_count": 1,
    "response_time_ms": 420,
    "cpu_usage_percent": 64,
    "memory_usage_percent": 71
  },
  "dependencies": [
    { "service_name": "orders-db", "service_type": "database" }
  ],
  "attributes": {
    "deployment.version": "2026.11.06"
  },
  "trace": {
    "trace_id": "trace-123",
    "span_id": "span-456",
    "operation": "POST /orders",
    "duration_ms": 420,
    "status": "OK"
  }
}
```

The API exposes the product data through:

- `GET /observability/overview`
- `GET /observability/services`
- `GET /observability/services/{service_id}/timeseries`
- `GET /observability/topology`
- `GET /observability/alerts`
- `GET /observability/traces`

## Install the Windows host agent

In **Application Monitoring**, select **Install Host Agent**, enter the APM
backend URL reachable from the target host, and download the generated ZIP.
Extract the ZIP on that Windows host, then run `install_agent.bat` as
Administrator. The installer registers `AIPredictiveAPMAgent` with Windows
automatic startup, starts it immediately, and configures Windows to restart it
after a service failure. It will also run after reboot when nobody signs in.
Run `uninstall_agent.bat` as Administrator to remove the service and its
installed files.

### Host the website

The frontend uses `VITE_API_BASE_URL` when it is set. Create a frontend
environment file from `frontend/.env.example` and set this value to the public
FastAPI URL when the frontend and backend use different hosts. When they share
an origin, the frontend uses the website origin by default. This same address
is embedded in generated agent packages, so target hosts must be able to reach
it.

For a separate frontend domain, set the backend's `APM_CORS_ORIGINS` to the
comma-separated frontend origins, including scheme and port when applicable.
For example: `https://apm.example.com`. Keep this list limited to your website
origins.

The installer targets Windows hosts. The service startup setting is Windows'
automatic start type, which starts the service after each restart without a
user logon. See [Microsoft's `sc.exe config` documentation](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/sc-config).

## Recommended next production steps

Add authentication to telemetry ingestion, persist metrics and traces, use
OpenTelemetry receivers, deploy an alert evaluator, and store user and incident
data outside the process. Keep metric labels low-cardinality; do not put user
IDs, request IDs, or raw URLs into them.
