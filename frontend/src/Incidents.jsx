import { useEffect, useState, useCallback } from "react";

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { getIncidents } from "./api";
import { readIncidentMetrics, formatIncidentMetric, isZeroSnapshot } from "./incidentMetrics";
import "./Incidents.css";

function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // LOAD INCIDENTS FROM BACKEND
  const loadIncidents = useCallback(async () => {
    try {
      setError("");

      const data = await getIncidents();

      console.log("Incidents API response:", data);

      // Support both an array and an object containing incidents.
      const incidentList = Array.isArray(data)
        ? data
        : Array.isArray(data?.incidents)
        ? data.incidents
        : Array.isArray(data?.data?.incidents)
        ? data.data.incidents
        : [];

      console.log("Incidents loaded:", incidentList.length);
      console.log("First incident:", incidentList[0] ?? "No incidents");

      setIncidents(incidentList);
    } catch (err) {
      console.error("Failed to load incidents:", err);
      setError(err?.message || "Failed to load incidents.");
    } finally {
      setLoading(false);
    }
  }, []);

  // INITIAL LOAD AND AUTO REFRESH
  useEffect(() => {
    loadIncidents();

    const interval = setInterval(() => {
      loadIncidents();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadIncidents]);

  // SEVERITY STYLE
  function getSeverityClass(severity) {
    switch (String(severity || "INFO").toUpperCase()) {
      case "CRITICAL":
        return "incident-critical";
      case "WARNING":
        return "incident-warning";
      case "INFO":
        return "incident-info";
      default:
        return "incident-info";
    }
  }

  // STATUS STYLE
  function getStatusClass(status) {
    switch (String(status || "OPEN").toUpperCase()) {
      case "OPEN":
        return "status-open";
      case "RESOLVED":
        return "status-resolved";
      case "ESCALATED":
        return "status-escalated";
      default:
        return "status-open";
    }
  }

  // SAFELY FORMAT ROOT CAUSE
  function getRootCauses(incident) {
    const value =
      incident?.root_cause ??
      incident?.rootCause ??
      incident?.root_causes;

    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "string"
            ? item
            : item?.description || item?.message || JSON.stringify(item)
        )
        .filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return [value];
    }

    return [];
  }

  // FORMAT TIMESTAMP
  function formatTimestamp(value) {
    if (!value) return "Recently detected";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString();
  }

  return (
    <div className="incidents-page">
      {/* HEADER */}
      <div className="incidents-header">
        <div>
          <span className="eyebrow">
            APPLICATION PERFORMANCE MONITORING
          </span>

          <h2>Incident Management</h2>

          <p>Monitor, analyze and track application incidents</p>

          <p>
            Total incidents: <strong>{incidents.length}</strong>
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={loadIncidents}
          disabled={loading}
          title="Refresh incidents"
        >
          <RefreshCw
            size={17}
            className={loading ? "refresh-spinning" : ""}
          />
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="incident-error">
          <AlertTriangle size={18} />
          <span>{error}</span>

          <button type="button" onClick={loadIncidents}>
            Retry
          </button>
        </div>
      )}

      {/* LOADING */}
      {loading && incidents.length === 0 && !error && (
        <div className="incident-loading">
          Loading incidents...
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && incidents.length === 0 && (
        <div className="incident-empty">
          <CheckCircle size={45} />

          <h3>No Incidents</h3>

          <p>
            No incidents have been detected yet.
          </p>
        </div>
      )}

      {/* INCIDENT LIST */}
      {incidents.length > 0 && (
        <div className="incident-list">
          {incidents.map((incident, index) => {
            const severity = String(
              incident?.severity ?? "INFO"
            ).toUpperCase();

            const status = String(
              incident?.status ?? "OPEN"
            ).toUpperCase();

            const rootCauses = getRootCauses(incident);

            const incidentId =
              incident?.id ??
              incident?.incident_id ??
              `INC-${index + 1}`;

            const title =
              incident?.problem ??
              incident?.title ??
              incident?.name ??
              "Application Performance Incident";

            const snapshot = readIncidentMetrics(incident);
            const { cpu, memory, latency, errorRate } = snapshot;

            const risk = incident?.risk ?? "Not available";

            return (
              <div
                className="incident-card"
                key={incidentId}
              >
                {/* INCIDENT HEADER */}
                <div className="incident-card-top">
                  <div className="incident-title">
                    <div
                      className={`incident-icon ${getSeverityClass(
                        severity
                      )}`}
                    >
                      <ShieldAlert size={20} />
                    </div>

                    <div>
                      <h3>{title}</h3>

                      <span>Incident ID: {incidentId}</span>
                    </div>
                  </div>

                  <div className="incident-badges">
                    <span
                      className={`severity-badge ${getSeverityClass(
                        severity
                      )}`}
                    >
                      {severity}
                    </span>

                    <span
                      className={`status-badge ${getStatusClass(
                        status
                      )}`}
                    >
                      {status}
                    </span>
                  </div>
                </div>

                {/* METRICS */}
                <div className="incident-snapshot-label">
                  <Clock size={13} />
                  Readings recorded when this incident was detected
                </div>
                <div className="incident-details">
                  <div>
                    <span className="detail-label">Risk</span>
                    <strong>{String(risk).toUpperCase()}</strong>
                  </div>

                  <div>
                    <span className="detail-label">CPU</span>
                    <strong>
                      {formatIncidentMetric(cpu, 1, "%")}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-label">Memory</span>
                    <strong>
                      {formatIncidentMetric(memory, 1, "%")}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-label">Latency</span>
                    <strong>
                      {formatIncidentMetric(latency, 3, " s")}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-label">Error Rate</span>
                    <strong>
                      {formatIncidentMetric(errorRate, 2, "%")}
                    </strong>
                  </div>
                </div>

                {isZeroSnapshot(snapshot) && (
                  <p className="incident-zero-note">
                    This incident was saved with zero readings. Open Overview for current live metrics.
                  </p>
                )}

                {/* ROOT CAUSE */}
                <div className="incident-root-cause">
                  <div className="incident-section-title">
                    <AlertTriangle size={16} />
                    Root Cause
                  </div>

                  {rootCauses.length > 0 ? (
                    <ul>
                      {rootCauses.map((cause, causeIndex) => (
                        <li key={causeIndex}>{cause}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      Root cause analysis is not available yet.
                    </p>
                  )}
                </div>

                {/* SELF-HEALING */}
                {(incident?.self_healing_action ||
                  incident?.selfHealingAction) && (
                  <div className="incident-root-cause">
                    <div className="incident-section-title">
                      <CheckCircle size={16} />
                      Self-Healing Action
                    </div>

                    <ul>
                      <li>
                        {incident.self_healing_action ??
                          incident.selfHealingAction}
                      </li>
                    </ul>
                  </div>
                )}

                {/* FOOTER */}
                <div className="incident-footer">
                  <div>
                    <Clock size={14} />
                    <span>
                      {formatTimestamp(
                        incident?.timestamp ??
                          incident?.created_at ??
                          incident?.createdAt
                      )}
                    </span>
                  </div>

                  {status === "RESOLVED" && (
                    <div className="resolved-text">
                      <CheckCircle size={14} />
                      Incident Resolved
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Incidents;
