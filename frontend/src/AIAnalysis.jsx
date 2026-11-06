import { useEffect, useState } from "react";
import {
  Brain,
  AlertTriangle,
  Zap,
  RefreshCw,
  CheckCircle,
  Activity,
  Target,
} from "lucide-react";

import { getAIAnalysis } from "./api";

function AIAnalysis() {
  const [ai, setAI] = useState({
    ai_status: "LOADING",
    anomaly: false,
    anomaly_score: 0,
    prediction: {
      risk: "LOW",
      risk_score: 0,
    },
    root_cause: [],
    recommendations: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAIAnalysis() {
    try {
      setLoading(true);
      setError("");

      const data = await getAIAnalysis();

      setAI({
        ai_status: data?.ai_status || "READY",
        anomaly: data?.anomaly || false,
        anomaly_score: data?.anomaly_score || 0,

        prediction: {
          risk: data?.prediction?.risk || "LOW",
          risk_score: data?.prediction?.risk_score || 0,
        },

        root_cause: Array.isArray(data?.root_cause)
          ? data.root_cause
          : [],

        recommendations: Array.isArray(data?.recommendations)
          ? data.recommendations
          : [],
      });
    } catch (err) {
      console.error("AI Analysis error:", err);
      setError("Unable to connect to AI analysis service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAIAnalysis();

    const interval = setInterval(
      loadAIAnalysis,
      5000
    );

    return () => clearInterval(interval);
  }, []);

  const isHighRisk =
    ai.prediction?.risk === "HIGH";

  const isMediumRisk =
    ai.prediction?.risk === "MEDIUM";

  return (
    <section className="ai-analysis-page">

      {/* HEADER */}
      <div className="ai-analysis-header">

        <div>
          <span className="eyebrow">
            ARTIFICIAL INTELLIGENCE
          </span>

          <h2>AI Analysis</h2>

          <p>
            Intelligent anomaly detection,
            prediction and root-cause analysis.
          </p>
        </div>

        <button
          className="ai-refresh-button"
          onClick={loadAIAnalysis}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={
              loading
                ? "refresh-spinning"
                : ""
            }
          />

          Refresh
        </button>

      </div>


      {/* ERROR */}
      {error && (
        <div className="ai-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}


      {/* STATUS */}
      <div className="ai-status-card">

        <div className="ai-status-icon">
          <Brain size={25} />
        </div>

        <div className="ai-status-info">
          <strong>
            AI Engine
          </strong>

          <span>
            Real-time predictive analysis
          </span>
        </div>

        <div
          className={
            ai.ai_status === "LOADING"
              ? "ai-engine-status loading"
              : "ai-engine-status"
          }
        >
          <span />

          {ai.ai_status === "LOADING"
            ? "Processing"
            : "Active"}
        </div>

      </div>


      {/* MAIN AI CARDS */}
      <div className="ai-analysis-grid">

        {/* ANOMALY */}
        <div className="ai-analysis-card">

          <div className="ai-analysis-card-header">

            <div className="ai-analysis-icon">
              <Activity size={20} />
            </div>

            <div>
              <strong>
                Anomaly Detection
              </strong>

              <span>
                ML-based system analysis
              </span>
            </div>

          </div>

          <div
            className={
              ai.anomaly
                ? "ai-analysis-value anomaly"
                : "ai-analysis-value normal"
            }
          >
            {ai.anomaly
              ? "ANOMALY DETECTED"
              : "SYSTEM NORMAL"}
          </div>

          <div className="ai-score">

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


        {/* PREDICTIVE RISK */}
        <div className="ai-analysis-card">

          <div className="ai-analysis-card-header">

            <div className="ai-analysis-icon risk-icon">
              <Target size={20} />
            </div>

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
              isHighRisk
                ? "ai-analysis-value high-risk"
                : isMediumRisk
                ? "ai-analysis-value medium-risk"
                : "ai-analysis-value low-risk"
            }
          >
            {ai.prediction?.risk || "LOW"}
          </div>

          <div className="ai-score">

            <span>
              Risk Score
            </span>

            <strong>
              {ai.prediction?.risk_score ?? 0}
            </strong>

          </div>

        </div>

      </div>


      {/* ROOT CAUSE + RECOMMENDATIONS */}
      <div className="ai-analysis-details-grid">

        {/* ROOT CAUSE */}
        <div className="ai-detail-card">

          <div className="ai-detail-header">

            <div className="ai-detail-title">
              <AlertTriangle size={19} />

              <div>
                <strong>
                  Root Cause Analysis
                </strong>

                <span>
                  Problems identified by AI
                </span>
              </div>
            </div>

          </div>

          {loading ? (
            <p className="ai-muted">
              Analyzing system data...
            </p>
          ) : ai.root_cause.length > 0 ? (

            <ul className="ai-list">

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

            <div className="ai-empty">

              <CheckCircle size={22} />

              <span>
                No active root cause detected.
              </span>

            </div>

          )}

        </div>


        {/* RECOMMENDATIONS */}
        <div className="ai-detail-card">

          <div className="ai-detail-header">

            <div className="ai-detail-title">
              <Zap size={19} />

              <div>
                <strong>
                  AI Recommendations
                </strong>

                <span>
                  Suggested corrective actions
                </span>
              </div>
            </div>

          </div>

          {loading ? (
            <p className="ai-muted">
              Generating recommendations...
            </p>
          ) : ai.recommendations.length > 0 ? (

            <ul className="ai-list recommendation-list">

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

            <div className="ai-empty">

              <CheckCircle size={22} />

              <span>
                No recommendations required.
              </span>

            </div>

          )}

        </div>

      </div>


      {/* AI PIPELINE */}
      <div className="ai-pipeline">

        <div className="ai-pipeline-title">
          <Brain size={18} />

          <div>
            <strong>
              AI Processing Pipeline
            </strong>

            <span>
              How your predictive engine analyzes
              application performance
            </span>
          </div>
        </div>


        <div className="ai-pipeline-flow">

          <PipelineStep
            number="01"
            title="Collect Metrics"
            text="CPU, memory, latency and errors"
          />

          <div className="pipeline-arrow">
            →
          </div>

          <PipelineStep
            number="02"
            title="ML Detection"
            text="Identify abnormal behavior"
          />

          <div className="pipeline-arrow">
            →
          </div>

          <PipelineStep
            number="03"
            title="Predict Risk"
            text="Estimate future incidents"
          />

          <div className="pipeline-arrow">
            →
          </div>

          <PipelineStep
            number="04"
            title="RCA"
            text="Identify possible root causes"
          />

        </div>

      </div>

    </section>
  );
}


function PipelineStep({
  number,
  title,
  text,
}) {
  return (
    <div className="pipeline-step">

      <div className="pipeline-number">
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


export default AIAnalysis;