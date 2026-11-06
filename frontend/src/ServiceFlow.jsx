import { useEffect, useState } from "react";

import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Network,
  RefreshCw,
  Route,
  Server,
  ShieldCheck,
  Timer,
} from "lucide-react";

import {
  getObservabilityAlerts,
  getObservabilityOverview,
  getServices,
  getTopology,
  getTraces,
  ingestServiceTelemetry,
} from "./api";

import "./ServiceFlow.css";


const EMPTY_OVERVIEW = {
  services: { total: 0, HEALTHY: 0, WARNING: 0, CRITICAL: 0 },
  alerts: { open: 0 },
  slo: { availability_percent: 100, status: "MET" },
  topology: { nodes: 0, edges: 0 },
};


const DEMO_OVERVIEW = {
  services: { total: 3, HEALTHY: 2, WARNING: 0, CRITICAL: 1 },
  alerts: { open: 2 },
  slo: { availability_percent: 97.27, status: "AT_RISK" },
  topology: { nodes: 5, edges: 4 },
};

const DEMO_SERVICES = [
  {
    id: "demo:web-store",
    name: "web-store",
    type: "web-service",
    environment: "demo",
    health: "HEALTHY",
    metrics: { request_count: 160, error_count: 3, error_rate_percent: 1.88, p95_latency_ms: 112, cpu_usage_percent: 42 },
    slo: { availability_percent: 98.12 },
  },
  {
    id: "demo:checkout-api",
    name: "checkout-api",
    type: "service",
    environment: "demo",
    health: "CRITICAL",
    metrics: { request_count: 150, error_count: 12, error_rate_percent: 8, p95_latency_ms: 1480, cpu_usage_percent: 78 },
    slo: { availability_percent: 92 },
  },
  {
    id: "demo:catalog-api",
    name: "catalog-api",
    type: "service",
    environment: "demo",
    health: "HEALTHY",
    metrics: { request_count: 240, error_count: 0, error_rate_percent: 0, p95_latency_ms: 43, cpu_usage_percent: 31 },
    slo: { availability_percent: 100 },
  },
];

const DEMO_TOPOLOGY = {
  nodes: [
    { id: "demo:web-store", name: "web-store", type: "web-service", environment: "demo", health: "HEALTHY" },
    { id: "demo:checkout-api", name: "checkout-api", type: "service", environment: "demo", health: "CRITICAL" },
    { id: "demo:catalog-api", name: "catalog-api", type: "service", environment: "demo", health: "HEALTHY" },
    { id: "demo:orders-db", name: "orders-db", type: "database", environment: "demo", health: "HEALTHY" },
    { id: "demo:products-db", name: "products-db", type: "database", environment: "demo", health: "HEALTHY" },
  ],
  edges: [
    { source: "demo:web-store", target: "demo:checkout-api", type: "service" },
    { source: "demo:web-store", target: "demo:catalog-api", type: "service" },
    { source: "demo:checkout-api", target: "demo:orders-db", type: "database" },
    { source: "demo:catalog-api", target: "demo:products-db", type: "database" },
  ],
};

const DEMO_ALERTS = [
  { id: "demo-alert-1", severity: "CRITICAL", title: "High p95 latency", service_name: "checkout-api", value: 1480, unit: "ms" },
  { id: "demo-alert-2", severity: "CRITICAL", title: "High error rate", service_name: "checkout-api", value: 8, unit: "%" },
];

const DEMO_TRACES = [
  { trace_id: "demo-trace-1", span_id: "demo-span-1", status: "ERROR", operation: "POST /orders", service_name: "checkout-api", duration_ms: 1480 },
  { trace_id: "demo-trace-2", span_id: "demo-span-2", status: "OK", operation: "GET /checkout", service_name: "web-store", duration_ms: 112 },
  { trace_id: "demo-trace-3", span_id: "demo-span-3", status: "OK", operation: "GET /products", service_name: "catalog-api", duration_ms: 43 },
];


function ServiceFlow({ demoMode = false }) {
  const [overview, setOverview] = useState(demoMode ? DEMO_OVERVIEW : EMPTY_OVERVIEW);
  const [services, setServices] = useState(demoMode ? DEMO_SERVICES : []);
  const [topology, setTopology] = useState(demoMode ? DEMO_TOPOLOGY : { nodes: [], edges: [] });
  const [alerts, setAlerts] = useState(demoMode ? DEMO_ALERTS : []);
  const [traces, setTraces] = useState(demoMode ? DEMO_TRACES : []);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function load() {
    if (demoMode) {
      setOverview(DEMO_OVERVIEW);
      setServices(DEMO_SERVICES);
      setTopology(DEMO_TOPOLOGY);
      setAlerts(DEMO_ALERTS);
      setTraces(DEMO_TRACES);
      setLastUpdated(new Date());
      setLoading(false);
      return;
    }

    try {
      setError("");

      const [overviewData, servicesData, topologyData, alertsData, tracesData] =
        await Promise.all([
          getObservabilityOverview(),
          getServices(),
          getTopology(),
          getObservabilityAlerts(),
          getTraces(),
        ]);

      setOverview(overviewData || EMPTY_OVERVIEW);
      setServices(servicesData?.services || []);
      setTopology(topologyData || { nodes: [], edges: [] });
      setAlerts(alertsData?.alerts || []);
      setTraces(tracesData?.traces || []);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError.message || "Unable to load service telemetry.");
    } finally {
      setLoading(false);
    }
  }

  async function seedDemoTraffic() {
    if (demoMode) {
      await load();
      return;
    }

    setSeeding(true);
    setError("");

    try {
      await Promise.all([
        ingestServiceTelemetry({
          service_name: "web-store",
          service_type: "web-service",
          environment: "demo",
          hostname: "store-web-01",
          metrics: {
            request_count: 160,
            error_count: 3,
            response_time_ms: 112,
            cpu_usage_percent: 42,
            memory_usage_percent: 58,
          },
          dependencies: [
            { service_name: "checkout-api", service_type: "service" },
            { service_name: "catalog-api", service_type: "service" },
          ],
          trace: {
            trace_id: "demo-checkout-trace",
            span_id: "web-store-span",
            operation: "GET /checkout",
            duration_ms: 112,
            status: "OK",
          },
        }),
        ingestServiceTelemetry({
          service_name: "checkout-api",
          service_type: "service",
          environment: "demo",
          hostname: "checkout-01",
          metrics: {
            request_count: 150,
            error_count: 12,
            response_time_ms: 1480,
            cpu_usage_percent: 78,
            memory_usage_percent: 72,
          },
          dependencies: [
            { service_name: "orders-db", service_type: "database" },
          ],
          trace: {
            trace_id: "demo-checkout-trace",
            span_id: "checkout-span",
            parent_span_id: "web-store-span",
            operation: "POST /orders",
            duration_ms: 1480,
            status: "ERROR",
          },
        }),
        ingestServiceTelemetry({
          service_name: "catalog-api",
          service_type: "service",
          environment: "demo",
          hostname: "catalog-01",
          metrics: {
            request_count: 240,
            error_count: 0,
            response_time_ms: 43,
            cpu_usage_percent: 31,
            memory_usage_percent: 46,
          },
          dependencies: [
            { service_name: "products-db", service_type: "database" },
          ],
        }),
      ]);

      await load();
    } catch (seedError) {
      setError(seedError.message || "Unable to add demo telemetry.");
    } finally {
      setSeeding(false);
    }
  }

  useEffect(() => {
    load();
    if (demoMode) return undefined;

    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [demoMode]);

  const nodeNames = Object.fromEntries(
    topology.nodes.map((node) => [node.id, node.name])
  );

  return (
    <section className="service-flow-page">
      <div className="service-flow-header">
        <div>
          <span className="eyebrow">{demoMode ? "SERVICE FLOW · DEMO PREVIEW" : "SERVICE OBSERVABILITY"}</span>
          <h2>Service flow</h2>
          <p>See health, dependencies, traces, alerts, and SLO risk in one place.</p>
        </div>

        <div className="service-flow-actions">
          <button className="flow-secondary-button" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "flow-spin" : ""} />
            Refresh
          </button>
          <button className="flow-primary-button" onClick={seedDemoTraffic} disabled={seeding}>
            <Boxes size={16} />
            {demoMode ? "Refresh preview" : seeding ? "Adding demo..." : "Add demo traffic"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flow-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="flow-summary-grid">
        <SummaryCard icon={<Server />} label="Services" value={overview.services?.total || 0}
          detail={`${overview.services?.HEALTHY || 0} healthy`} />
        <SummaryCard icon={<ShieldCheck />} label="Availability" value={`${Number(overview.slo?.availability_percent || 0).toFixed(2)}%`}
          detail={overview.slo?.status === "MET" ? "SLO target met" : "SLO at risk"}
          state={overview.slo?.status === "MET" ? "healthy" : "warning"} />
        <SummaryCard icon={<AlertTriangle />} label="Open alerts" value={overview.alerts?.open || 0}
          detail="Current violations" state={overview.alerts?.open ? "critical" : "healthy"} />
        <SummaryCard icon={<Network />} label="Dependencies" value={overview.topology?.edges || 0}
          detail={`${overview.topology?.nodes || 0} mapped entities`} />
      </div>

      <div className="flow-layout">
        <div className="flow-card flow-topology-card">
          <div className="flow-card-heading">
            <div><Route size={19} /><h3>Topology</h3></div>
            <span>{topology.nodes.length} entities</span>
          </div>

          {topology.nodes.length === 0 ? (
            <div className="flow-empty">
              <Boxes size={28} />
              <strong>No service data yet</strong>
              <span>Send telemetry to the intake API or add the local demo traffic.</span>
            </div>
          ) : (
            <>
              <div className="flow-nodes">
                {topology.nodes.map((node) => (
                  <div className={`flow-node ${node.health.toLowerCase()}`} key={node.id}>
                    <span className="flow-node-type">{node.type}</span>
                    <strong>{node.name}</strong>
                    <small>{node.environment}</small>
                    <em>{node.health}</em>
                  </div>
                ))}
              </div>
              {topology.edges.length > 0 && (
                <div className="flow-connections">
                  {topology.edges.map((edge) => (
                    <div key={`${edge.source}-${edge.target}`}>
                      <span>{nodeNames[edge.source] || edge.source}</span>
                      <b>→</b>
                      <span>{nodeNames[edge.target] || edge.target}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flow-card flow-alerts-card">
          <div className="flow-card-heading">
            <div><AlertTriangle size={19} /><h3>Active alerts</h3></div>
            <span>{alerts.length} open</span>
          </div>
          {alerts.length === 0 ? (
            <div className="flow-empty compact"><CheckCircle2 size={24} /><span>No active alert violations.</span></div>
          ) : (
            <div className="flow-alert-list">
              {alerts.map((alert) => (
                <div className={`flow-alert ${alert.severity.toLowerCase()}`} key={alert.id}>
                  <span>{alert.severity}</span>
                  <strong>{alert.title}</strong>
                  <small>{alert.service_name}: {Number(alert.value).toFixed(2)}{alert.unit}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flow-card flow-services-card">
        <div className="flow-card-heading">
          <div><Activity size={19} /><h3>Service health</h3></div>
          <span>15-minute window</span>
        </div>
        <div className="flow-table-wrap">
          <table className="flow-table">
            <thead>
              <tr><th>Service</th><th>Health</th><th>Requests</th><th>Error rate</th><th>p95 latency</th><th>SLO</th></tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr><td colSpan="6" className="flow-table-empty">Waiting for service telemetry.</td></tr>
              ) : services.map((service) => (
                <tr key={service.id}>
                  <td><strong>{service.name}</strong><small>{service.type} · {service.environment}</small></td>
                  <td><span className={`flow-health ${service.health.toLowerCase()}`}>{service.health}</span></td>
                  <td>{service.metrics.request_count}</td>
                  <td>{Number(service.metrics.error_rate_percent).toFixed(2)}%</td>
                  <td>{Number(service.metrics.p95_latency_ms).toFixed(0)} ms</td>
                  <td>{Number(service.slo.availability_percent).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flow-card flow-traces-card">
        <div className="flow-card-heading"><div><Timer size={19} /><h3>Recent traces</h3></div><span>{traces.length} captured</span></div>
        {traces.length === 0 ? (
          <div className="flow-empty compact"><Timer size={24} /><span>Traces appear here when telemetry includes a trace span.</span></div>
        ) : (
          <div className="flow-trace-list">
            {traces.map((trace) => (
              <div className="flow-trace" key={`${trace.trace_id}-${trace.span_id}`}>
                <span className={trace.status === "ERROR" ? "trace-error" : "trace-ok"}>{trace.status}</span>
                <strong>{trace.operation}</strong>
                <small>{trace.service_name}</small>
                <em>{Number(trace.duration_ms).toFixed(0)} ms</em>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="flow-footer">
        <span className={error ? "flow-dot offline" : "flow-dot"} />
        {demoMode ? "Sample data preview" : error ? "Telemetry API unavailable" : "Live telemetry API connected"}
        {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
      </footer>
    </section>
  );
}


function SummaryCard({ icon, label, value, detail, state = "" }) {
  return (
    <div className={`flow-summary-card ${state}`}>
      <div>{icon}<span>{label}</span></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}


export default ServiceFlow;
