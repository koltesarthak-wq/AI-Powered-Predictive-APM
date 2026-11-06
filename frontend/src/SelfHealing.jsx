import { useEffect, useState } from "react";

import {
  ShieldCheck,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Cpu,
  Database,
  Clock,
  Zap,
  Play,
} from "lucide-react";

import {
  getSelfHealing,
  executeSelfHealing,
} from "./api";

import "./SelfHealing.css";


function SelfHealing() {

  const [data, setData] = useState({
    self_healing: {
      status: "LOADING",
      action: "Waiting for backend...",
    },

    ai_analysis: {
      status: "LOADING",
      anomaly: false,
      anomaly_score: 0,
      root_cause: [],
      recommendations: [],
      prediction: {
        risk: "LOW",
        risk_score: 0,
      },
    },

    metrics: {
      cpu_usage_percent: 0,
      memory_usage_percent: 0,
      latency_seconds: 0,
      error_rate_percent: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const [executionMessage, setExecutionMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);


  // =========================================================
  // LOAD SELF-HEALING DATA
  // =========================================================

  async function loadSelfHealing() {

    try {

      setError("");

      const response = await getSelfHealing();

      setData({

        self_healing:
          response?.self_healing || {
            status: "NOT_REQUIRED",
            action: "Monitoring recovery engine",
          },

        ai_analysis:
          response?.ai_analysis || {
            status: "UNKNOWN",
            anomaly: false,
            anomaly_score: 0,
            root_cause: [],
            recommendations: [],
            prediction: {
              risk: "LOW",
              risk_score: 0,
            },
          },

        metrics:
          response?.metrics || {
            cpu_usage_percent: 0,
            memory_usage_percent: 0,
            latency_seconds: 0,
            error_rate_percent: 0,
          },

      });

      setLastUpdated(new Date());

    }

    catch (err) {

      console.error(
        "Self-Healing error:",
        err
      );

      setError(
        err.message ||
        "Unable to connect to Self-Healing backend."
      );

    }

    finally {

      setLoading(false);

    }

  }


  // =========================================================
  // EXECUTE RECOVERY
  // =========================================================

  async function handleExecuteRecovery() {

    try {

      setExecuting(true);
      setError("");
      setExecutionMessage("");

      const response =
        await executeSelfHealing();

      console.log(
        "Recovery execution response:",
        response
      );


      // Update the UI immediately using backend response

      if (response?.self_healing) {

        setData((previous) => ({

          ...previous,

          self_healing:
            response.self_healing,

          ai_analysis:
            response.ai_analysis ||
            previous.ai_analysis,

          metrics:
            response.metrics ||
            previous.metrics,

        }));

      }


      setExecutionMessage(
        response?.message ||
        response?.self_healing?.action ||
        "Recovery action executed successfully."
      );


      // Reload latest backend state

      await loadSelfHealing();

    }

    catch (err) {

      console.error(
        "Recovery execution error:",
        err
      );

      setError(
        err.message ||
        "Failed to execute recovery action."
      );

    }

    finally {

      setExecuting(false);

    }

  }


  // =========================================================
  // AUTO REFRESH
  // =========================================================

  useEffect(() => {

    loadSelfHealing();

    const interval =
      setInterval(
        loadSelfHealing,
        5000
      );

    return () =>
      clearInterval(interval);

  }, []);


  const healing =
    data.self_healing || {};

  const ai =
    data.ai_analysis || {};

  const metrics =
    data.metrics || {};


  const status =
    healing.status || "NOT_REQUIRED";


  // =========================================================
  // SHOULD SHOW EXECUTE BUTTON?
  // =========================================================

  const canExecuteRecovery =
    status === "RECOMMENDATION" ||
    ai.anomaly === true ||
    ai.prediction?.risk === "HIGH" ||
    ai.prediction?.risk === "MEDIUM";


  // =========================================================
  // STATUS HELPERS
  // =========================================================

  function getStatusTitle() {

    switch (status) {

      case "ACTION_EXECUTED":
        return "Recovery Action Executed";

      case "ACTION_FAILED":
        return "Recovery Action Failed";

      case "RECOMMENDATION":
        return "Healing Recommended";

      case "NOT_REQUIRED":
        return "System Healthy";

      case "LOADING":
        return "Analyzing System";

      default:
        return status;

    }

  }


  function getStatusClass() {

    switch (status) {

      case "ACTION_EXECUTED":
        return "healing-success";

      case "ACTION_FAILED":
        return "healing-failed";

      case "RECOMMENDATION":
        return "healing-warning";

      case "LOADING":
        return "healing-loading";

      default:
        return "healing-ready";

    }

  }


  return (

    <section className="self-healing-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="self-healing-header">

        <div>

          <span className="eyebrow">
            AUTOMATED RECOVERY ENGINE
          </span>

          <h2>
            Self-Healing
          </h2>

          <p>
            Automatically detect problems,
            analyze root causes and execute
            recovery actions.
          </p>

        </div>


        <div className="healing-header-actions">

          <button
            className="healing-refresh-button"
            onClick={loadSelfHealing}
            disabled={loading || executing}
          >

            <RefreshCw
              size={16}
              className={
                loading
                  ? "healing-refresh-spinning"
                  : ""
              }
            />

            Refresh

          </button>


          {canExecuteRecovery && (

            <button
              className="healing-execute-button"
              onClick={handleExecuteRecovery}
              disabled={executing}
            >

              {executing ? (

                <>
                  <RefreshCw
                    size={16}
                    className="healing-refresh-spinning"
                  />

                  Executing...

                </>

              ) : (

                <>
                  <Play size={16} />

                  Execute Recovery

                </>

              )}

            </button>

          )}

        </div>

      </div>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (

        <div className="healing-error">

          <AlertTriangle size={18} />

          <span>
            {error}
          </span>

        </div>

      )}


      {/* =====================================================
          EXECUTION MESSAGE
      ===================================================== */}

      {executionMessage && !error && (

        <div className="healing-execution-success">

          <CheckCircle size={18} />

          <span>
            {executionMessage}
          </span>

        </div>

      )}


      {/* =====================================================
          MAIN STATUS
      ===================================================== */}

      <div
        className={`healing-status-card ${getStatusClass()}`}
      >

        <div className="healing-status-icon">

          {status === "ACTION_EXECUTED" ? (

            <CheckCircle size={30} />

          ) : status === "ACTION_FAILED" ? (

            <XCircle size={30} />

          ) : status === "RECOMMENDATION" ? (

            <AlertTriangle size={30} />

          ) : (

            <ShieldCheck size={30} />

          )}

        </div>


        <div className="healing-status-info">

          <span>
            SELF-HEALING STATUS
          </span>

          <h2>
            {getStatusTitle()}
          </h2>

          <p>
            {healing.action ||
              "Monitoring recovery engine"}
          </p>

        </div>


        <div className="healing-status-badge">

          {formatStatus(status)}

        </div>

      </div>


      {/* =====================================================
          METRICS
      ===================================================== */}

      <div className="healing-section-title">

        <div>

          <h3>
            Current System Condition
          </h3>

          <p>
            Metrics used by the AI recovery engine
          </p>

        </div>

      </div>


      <div className="healing-metrics-grid">

        <HealingMetric
          icon={<Cpu size={19} />}
          title="CPU Usage"
          value={Number(
            metrics.cpu_usage_percent || 0
          ).toFixed(1)}
          unit="%"
          danger={
            metrics.cpu_usage_percent > 80
          }
        />


        <HealingMetric
          icon={<Database size={19} />}
          title="Memory Usage"
          value={Number(
            metrics.memory_usage_percent || 0
          ).toFixed(1)}
          unit="%"
          danger={
            metrics.memory_usage_percent > 80
          }
        />


        <HealingMetric
          icon={<Clock size={19} />}
          title="Request Latency"
          value={Number(
            metrics.latency_seconds || 0
          ).toFixed(4)}
          unit="s"
          danger={
            metrics.latency_seconds > 1
          }
        />


        <HealingMetric
          icon={<Activity size={19} />}
          title="Error Rate"
          value={Number(
            metrics.error_rate_percent || 0
          ).toFixed(2)}
          unit="%"
          danger={
            metrics.error_rate_percent > 5
          }
        />

      </div>


      {/* =====================================================
          AI ANALYSIS
      ===================================================== */}

      <div className="healing-analysis-grid">

        {/* ANOMALY */}

        <div className="healing-card">

          <div className="healing-card-header">

            <Activity size={19} />

            <div>

              <strong>
                AI Anomaly Detection
              </strong>

              <span>
                ML system analysis
              </span>

            </div>

          </div>


          <div
            className={
              ai.anomaly
                ? "healing-value danger"
                : "healing-value success"
            }
          >

            {ai.anomaly
              ? "ANOMALY DETECTED"
              : "SYSTEM NORMAL"}

          </div>


          <div className="healing-score">

            <span>
              Anomaly Score
            </span>

            <strong>
              {Number(
                ai.anomaly_score || 0
              ).toFixed(4)}
            </strong>

          </div>

        </div>


        {/* RISK */}

        <div className="healing-card">

          <div className="healing-card-header">

            <Zap size={19} />

            <div>

              <strong>
                Predictive Risk
              </strong>

              <span>
                Future incident prediction
              </span>

            </div>

          </div>


          <div
            className={
              ai.prediction?.risk === "HIGH"
                ? "healing-value danger"
                : ai.prediction?.risk === "MEDIUM"
                ? "healing-value warning"
                : "healing-value success"
            }
          >

            {ai.prediction?.risk || "LOW"}

          </div>


          <div className="healing-score">

            <span>
              Risk Score
            </span>

            <strong>
              {ai.prediction?.risk_score ?? 0}
            </strong>

          </div>

        </div>

      </div>


      {/* =====================================================
          ROOT CAUSE + RECOMMENDATIONS
      ===================================================== */}

      <div className="healing-details-grid">

        {/* ROOT CAUSE */}

        <div className="healing-detail-card">

          <div className="healing-detail-header">

            <AlertTriangle size={19} />

            <div>

              <strong>
                Root Cause
              </strong>

              <span>
                Problems identified by AI
              </span>

            </div>

          </div>


          {ai.root_cause?.length > 0 ? (

            <ul className="healing-list">

              {ai.root_cause.map(
                (cause, index) => (

                  <li key={index}>

                    <span>
                      {index + 1}
                    </span>

                    {cause}

                  </li>

                )
              )}

            </ul>

          ) : (

            <div className="healing-empty">

              <CheckCircle size={20} />

              <span>
                No active root cause detected.
              </span>

            </div>

          )}

        </div>


        {/* RECOMMENDATIONS */}

        <div className="healing-detail-card">

          <div className="healing-detail-header">

            <Zap size={19} />

            <div>

              <strong>
                Recovery Recommendation
              </strong>

              <span>
                AI suggested corrective actions
              </span>

            </div>

          </div>


          {ai.recommendations?.length > 0 ? (

            <ul className="healing-list">

              {ai.recommendations.map(
                (recommendation, index) => (

                  <li key={index}>

                    <span>
                      {index + 1}
                    </span>

                    {recommendation}

                  </li>

                )
              )}

            </ul>

          ) : (

            <div className="healing-empty">

              <CheckCircle size={20} />

              <span>
                No recovery action required.
              </span>

            </div>

          )}

        </div>

      </div>


      {/* =====================================================
          RECOVERY ACTION
      ===================================================== */}

      <div className="healing-action-card">

        <div className="healing-action-icon">
          <ShieldCheck size={24} />
        </div>

        <div className="healing-action-content">

          <span className="healing-action-label">
            RECOVERY ENGINE
          </span>

          <h3>
            {status === "ACTION_EXECUTED"
              ? "Recovery completed"
              : status === "ACTION_FAILED"
              ? "Recovery failed"
              : "Recovery action"}
          </h3>

          <p>
            {healing.action ||
              "The AI recovery engine is monitoring the system."}
          </p>

        </div>


        {canExecuteRecovery && (

          <button
            className="healing-execute-large-button"
            onClick={handleExecuteRecovery}
            disabled={executing}
          >

            {executing ? (

              <>
                <RefreshCw
                  size={17}
                  className="healing-refresh-spinning"
                />

                Executing
              </>

            ) : (

              <>
                <Zap size={17} />

                Execute Recovery
              </>

            )}

          </button>

        )}

      </div>


      {/* =====================================================
          PIPELINE
      ===================================================== */}

      <div className="healing-pipeline">

        <div className="healing-pipeline-header">

          <ShieldCheck size={20} />

          <div>

            <strong>
              Self-Healing Pipeline
            </strong>

            <span>
              Automated detection and recovery workflow
            </span>

          </div>

        </div>


        <div className="healing-pipeline-flow">

          <PipelineStep
            number="01"
            title="Detect"
            text="Monitor system metrics"
          />

          <div className="healing-arrow">
            →
          </div>

          <PipelineStep
            number="02"
            title="Diagnose"
            text="Identify root cause"
          />

          <div className="healing-arrow">
            →
          </div>

          <PipelineStep
            number="03"
            title="Predict"
            text="Calculate incident risk"
          />

          <div className="healing-arrow">
            →
          </div>

          <PipelineStep
            number="04"
            title="Heal"
            text="Execute recovery action"
          />

        </div>

      </div>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <div className="healing-footer">

        <span>

          <span
            className={
              error
                ? "healing-dot offline"
                : "healing-dot"
            }
          />

          {error
            ? "Backend Offline"
            : "Backend Connected"}

        </span>


        <span>

          Last updated:{" "}

          {lastUpdated
            ? lastUpdated.toLocaleTimeString()
            : "Waiting..."}

        </span>

      </div>

    </section>

  );

}


// =========================================================
// METRIC COMPONENT
// =========================================================

function HealingMetric({
  icon,
  title,
  value,
  unit,
  danger,
}) {

  return (

    <div
      className={
        danger
          ? "healing-metric danger"
          : "healing-metric"
      }
    >

      <div className="healing-metric-header">

        <div className="healing-metric-icon">
          {icon}
        </div>

        <span>
          {title}
        </span>

      </div>


      <div className="healing-metric-value">

        {value}

        <small>
          {unit}
        </small>

      </div>


      <div
        className={
          danger
            ? "healing-metric-status danger-text"
            : "healing-metric-status"
        }
      >

        <span />

        {danger
          ? "High"
          : "Normal"}

      </div>

    </div>

  );

}


// =========================================================
// PIPELINE STEP
// =========================================================

function PipelineStep({
  number,
  title,
  text,
}) {

  return (

    <div className="healing-pipeline-step">

      <div className="healing-pipeline-number">
        {number}
      </div>

      <strong>
        {title}
      </strong>

      <span>
        {text}
      </span>

    </div>

  );

}


// =========================================================
// STATUS FORMATTER
// =========================================================

function formatStatus(status) {

  switch (status) {

    case "ACTION_EXECUTED":
      return "RECOVERED";

    case "ACTION_FAILED":
      return "FAILED";

    case "RECOMMENDATION":
      return "RECOMMENDED";

    case "NOT_REQUIRED":
      return "READY";

    case "LOADING":
      return "PROCESSING";

    default:
      return status || "READY";

  }

}


export default SelfHealing;