
import { useEffect, useState } from "react";

import {
  Activity,
  Cpu,
  Database,
  Network,
  Server,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
} from "lucide-react";

import { getSystemMetrics } from "./api";

import "./Applications.css";


function Applications() {

  const [metrics, setMetrics] = useState({
    cpu_usage_percent: 0,
    memory_usage_percent: 0,
    latency_seconds: 0,
    error_rate_percent: 0,
  });

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);


  // =====================================================
  // LOAD LIVE METRICS
  // =====================================================

  async function loadMetrics() {

    try {

      const data = await getSystemMetrics();

      setMetrics(data);

      setConnected(true);

      setLastUpdated(
        new Date()
      );

    } catch (error) {

      console.error(
        "Unable to load application metrics:",
        error
      );

      setConnected(false);

    } finally {

      setLoading(false);

    }
  }


  // =====================================================
  // AUTO REFRESH
  // =====================================================

  useEffect(() => {

    loadMetrics();

    const interval = setInterval(
      loadMetrics,
      5000
    );

    return () =>
      clearInterval(interval);

  }, []);


  // =====================================================
  // STATUS HELPERS
  // =====================================================

  function getCPUStatus(value) {

    if (value >= 90)
      return "Critical";

    if (value >= 80)
      return "High";

    return "Normal";
  }


  function getMemoryStatus(value) {

    if (value >= 90)
      return "Critical";

    if (value >= 80)
      return "High";

    return "Normal";
  }


  function getLatencyStatus(value) {

    if (value >= 3)
      return "Critical";

    if (value >= 1)
      return "High";

    return "Normal";
  }


  function getErrorStatus(value) {

    if (value >= 10)
      return "Critical";

    if (value >= 5)
      return "High";

    return "Normal";
  }


  function statusClass(status) {

    if (status === "Critical")
      return "status-critical";

    if (status === "High")
      return "status-high";

    return "status-normal";
  }


  // =====================================================
  // APPLICATION STATUS
  // =====================================================

  const applicationHealthy =
    connected &&
    metrics.cpu_usage_percent < 80 &&
    metrics.memory_usage_percent < 80 &&
    metrics.latency_seconds < 1 &&
    metrics.error_rate_percent < 5;


  return (

    <section className="applications-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="applications-header">

        <div>

          <span className="eyebrow">
            APPLICATION MONITORING
          </span>

          <h2>
            Applications
          </h2>

          <p>
            Monitor application performance and
            infrastructure health in real time.
          </p>

        </div>


        <button
          className="application-refresh"
          onClick={loadMetrics}
          title="Refresh metrics"
        >

          <RefreshCw size={16} />

          Refresh

        </button>

      </div>


      {/* =================================================
          CONNECTION STATUS
      ================================================= */}

      <div
        className={
          connected
            ? "application-connection connected"
            : "application-connection disconnected"
        }
      >

        {connected ? (
          <Wifi size={18} />
        ) : (
          <WifiOff size={18} />
        )}


        <div>

          <strong>

            {connected
              ? "APM Backend Connected"
              : "APM Backend Offline"}

          </strong>

          <span>

            {connected
              ? "Live monitoring data is being received."
              : "Unable to receive monitoring data."}

          </span>

        </div>

      </div>


      {/* =================================================
          APPLICATION OVERVIEW
      ================================================= */}

      <div className="application-overview">

        <div className="application-icon">

          <Server size={25} />

        </div>


        <div className="application-info">

          <h3>
            Monitored Application
          </h3>

          <p>
            FastAPI APM Application
          </p>

          <span>
            http://127.0.0.1:8001
          </span>

        </div>


        <div
          className={
            applicationHealthy
              ? "application-health healthy"
              : "application-health unhealthy"
          }
        >

          {applicationHealthy ? (
            <CheckCircle size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}

          {applicationHealthy
            ? "Healthy"
            : "Attention Required"}

        </div>

      </div>


      {/* =================================================
          LIVE METRICS
      ================================================= */}

      <div className="applications-section-title">

        <div>

          <h3>
            Live Performance Metrics
          </h3>

          <p>
            Automatically refreshed every 5 seconds.
          </p>

        </div>

        {lastUpdated && (

          <span className="last-updated">

            Last updated{" "}
            {lastUpdated.toLocaleTimeString()}

          </span>

        )}

      </div>


      <div className="application-metrics-grid">

        {/* CPU */}

        <ApplicationMetricCard
          icon={<Cpu />}
          title="CPU Usage"
          value={metrics.cpu_usage_percent}
          unit="%"
          status={getCPUStatus(
            metrics.cpu_usage_percent
          )}
          statusClass={statusClass(
            getCPUStatus(
              metrics.cpu_usage_percent
            )
          )}
        />


        {/* MEMORY */}

        <ApplicationMetricCard
          icon={<Database />}
          title="Memory Usage"
          value={metrics.memory_usage_percent}
          unit="%"
          status={getMemoryStatus(
            metrics.memory_usage_percent
          )}
          statusClass={statusClass(
            getMemoryStatus(
              metrics.memory_usage_percent
            )
          )}
        />


        {/* LATENCY */}

        <ApplicationMetricCard
          icon={<Activity />}
          title="Request Latency"
          value={metrics.latency_seconds}
          unit="s"
          decimals={4}
          status={getLatencyStatus(
            metrics.latency_seconds
          )}
          statusClass={statusClass(
            getLatencyStatus(
              metrics.latency_seconds
            )
          )}
        />


        {/* ERROR RATE */}

        <ApplicationMetricCard
          icon={<Network />}
          title="Error Rate"
          value={metrics.error_rate_percent}
          unit="%"
          decimals={2}
          status={getErrorStatus(
            metrics.error_rate_percent
          )}
          statusClass={statusClass(
            getErrorStatus(
              metrics.error_rate_percent
            )
          )}
        />

      </div>


      {/* =================================================
          MONITORING INFORMATION
      ================================================= */}

      <div className="monitoring-grid">

        <div className="monitoring-card">

          <div className="monitoring-card-header">

            <Activity size={19} />

            <span>
              Monitoring Engine
            </span>

          </div>

          <div className="monitoring-status">

            <span
              className={
                connected
                  ? "live-dot"
                  : "offline-dot"
              }
            />

            {connected
              ? "Live monitoring active"
              : "Monitoring unavailable"}

          </div>

          <p>
            The monitoring engine collects CPU,
            memory, latency and error-rate metrics
            from the FastAPI backend.
          </p>

        </div>


        <div className="monitoring-card">

          <div className="monitoring-card-header">

            <Server size={19} />

            <span>
              Application Endpoint
            </span>

          </div>

          <div className="endpoint">
            /system-metrics
          </div>

          <p>
            This endpoint provides the current
            application and system performance
            metrics used by the dashboard.
          </p>

        </div>

      </div>


      {loading && (

        <div className="application-loading">

          Loading live application metrics...

        </div>

      )}

    </section>

  );
}


// =========================================================
// METRIC CARD
// =========================================================

function ApplicationMetricCard({
  icon,
  title,
  value,
  unit,
  decimals = 1,
  status,
  statusClass,
}) {

  const numericValue =
    Number(value || 0);


  return (

    <div className="application-metric-card">

      <div className="application-metric-header">

        <div className="application-metric-icon">
          {icon}
        </div>

        <span>
          {title}
        </span>

      </div>


      <div className="application-metric-value">

        {numericValue.toFixed(
          decimals
        )}

        <small>
          {unit}
        </small>

      </div>


      <div
        className={
          `application-metric-status ${statusClass}`
        }
      >

        <span />

        {status}

      </div>

    </div>

  );
}


export default Applications;
