import { useEffect, useState } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./Login";
import Register from "./Register";
import ProtectedRoute from "./ProtectedRoute";

import {
  Activity,
  Brain,
  ShieldCheck,
  Server,
  AlertTriangle,
  Zap,
  ArrowRight,
  BarChart3,
  Cpu,
  Database,
  Network,
  RefreshCw,
} from "lucide-react";

import {
  getSystemMetrics,
  getAIAnalysis,
  getSelfHealing,
} from "./api";

import "./App.css";


// =========================================================
// MAIN APP
// =========================================================

function Dashboard() {

  return (
    <BrowserRouter>

      <Routes>

        {/* LOGIN */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* REGISTER */}
        <Route
          path="/register"
          element={<Register />}
        />

        {/* PROTECTED DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <APMDashboard />
            </ProtectedRoute>
          }
        />

        {/* DEFAULT */}
        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        {/* ANY UNKNOWN URL */}
        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}


// =========================================================
// APM DASHBOARD
// =========================================================

function APMDashboard() {

  const [activePage, setActivePage] =
    useState("dashboard");

  const [metrics, setMetrics] = useState({
    cpu_usage_percent: 0,
    memory_usage_percent: 0,
    latency_seconds: 0,
    error_rate_percent: 0,
  });

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

  const [healing, setHealing] = useState({
    status: "LOADING",
    action: "Waiting",
  });

  const [connected, setConnected] =
    useState(false);

  const [loading, setLoading] =
    useState(true);


  // =====================================================
  // LOAD DASHBOARD DATA
  // =====================================================

  async function loadDashboard() {

    try {

      const systemData =
        await getSystemMetrics();

      const aiData =
        await getAIAnalysis();

      const healingData =
        await getSelfHealing();


      setMetrics(systemData);

      setAI(aiData);

      setHealing(
        healingData.self_healing || {}
      );

      setConnected(true);

    }

    catch (error) {

      console.error(
        "APM backend connection error:",
        error
      );

      setConnected(false);

    }

    finally {

      setLoading(false);

    }
  }


  // =====================================================
  // AUTO REFRESH
  // =====================================================

  useEffect(() => {

    loadDashboard();

    const interval =
      setInterval(
        loadDashboard,
        5000
      );

    return () =>
      clearInterval(interval);

  }, []);


  // =====================================================
  // DASHBOARD UI
  // =====================================================

  return (

    <div className="app">


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="sidebar">

        <div className="logo">

          <div className="logo-icon">
            <Activity size={22} />
          </div>

          <div>

            <h2>
              Predictive APM
            </h2>

            <span>
              AI Monitoring Platform
            </span>

          </div>

        </div>


        <nav>

          <NavButton
            icon={<BarChart3 size={19} />}
            text="Dashboard"
            active={
              activePage === "dashboard"
            }
            onClick={() =>
              setActivePage("dashboard")
            }
          />

          <NavButton
            icon={<Server size={19} />}
            text="Applications"
            active={
              activePage === "applications"
            }
            onClick={() =>
              setActivePage("applications")
            }
          />

          <NavButton
            icon={<AlertTriangle size={19} />}
            text="Incidents"
            active={
              activePage === "incidents"
            }
            onClick={() =>
              setActivePage("incidents")
            }
          />

          <NavButton
            icon={<Brain size={19} />}
            text="AI Analysis"
            active={
              activePage === "ai"
            }
            onClick={() =>
              setActivePage("ai")
            }
          />

          <NavButton
            icon={<ShieldCheck size={19} />}
            text="Self-Healing"
            active={
              activePage === "healing"
            }
            onClick={() =>
              setActivePage("healing")
            }
          />

        </nav>


        {/* SIDEBAR STATUS */}

        <div className="sidebar-bottom">

          <div className="system-status">

            <span
              className={
                connected
                  ? "status-dot"
                  : "status-dot offline"
              }
            />

            <div>

              <strong>

                {connected
                  ? "System Online"
                  : "Backend Offline"}

              </strong>

              <small>
                APM Engine
              </small>

            </div>

          </div>

        </div>

      </aside>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="main">


        {/* TOPBAR */}

        <header className="topbar">

          <div>

            <h1>
              AI-Powered Predictive APM
            </h1>

            <p>
              Intelligent application performance
              monitoring
            </p>

          </div>


          <div className="topbar-actions">


            {/* CONNECTION */}

            <div className="connection-status">

              <span
                className={
                  connected
                    ? ""
                    : "offline"
                }
              />

              {connected
                ? "Backend Connected"
                : "Backend Offline"}

            </div>


            {/* REFRESH */}

            <button
              className="refresh-button"
              onClick={loadDashboard}
              title="Refresh"
            >

              <RefreshCw size={16} />

            </button>


            {/* PROFILE */}

            <button className="profile">
              SK
            </button>

          </div>

        </header>


        {/* =================================================
            DASHBOARD PAGE
        ================================================= */}

        {activePage === "dashboard" && (

          <section className="content">


            {/* WELCOME */}

            <div className="welcome">

              <div>

                <span className="eyebrow">
                  APPLICATION PERFORMANCE MONITORING
                </span>

                <h2>
                  Monitor. Predict. Heal.
                </h2>

                <p>
                  Detect application problems before
                  they become critical incidents using
                  AI-powered monitoring.
                </p>

              </div>


              <button
                className="primary-button"
                onClick={() =>
                  setActivePage(
                    "applications"
                  )
                }
              >

                Add Application

                <ArrowRight size={18} />

              </button>

            </div>


            {/* =================================================
                METRICS
            ================================================= */}

            <div className="metrics-grid">


              <MetricCard
                icon={<Cpu />}
                title="CPU Usage"
                value={
                  metrics.cpu_usage_percent
                    ?.toFixed(1)
                }
                unit="%"
                status={
                  metrics.cpu_usage_percent > 80
                    ? "High usage"
                    : "Normal"
                }
                danger={
                  metrics.cpu_usage_percent > 80
                }
              />


              <MetricCard
                icon={<Database />}
                title="Memory Usage"
                value={
                  metrics.memory_usage_percent
                    ?.toFixed(1)
                }
                unit="%"
                status={
                  metrics.memory_usage_percent > 80
                    ? "High usage"
                    : "Normal"
                }
                danger={
                  metrics.memory_usage_percent > 80
                }
              />


              <MetricCard
                icon={<Activity />}
                title="Request Latency"
                value={
                  metrics.latency_seconds
                    ?.toFixed(4)
                }
                unit="s"
                status={
                  metrics.latency_seconds > 1
                    ? "High latency"
                    : "Normal"
                }
                danger={
                  metrics.latency_seconds > 1
                }
              />


              <MetricCard
                icon={<Network />}
                title="Error Rate"
                value={
                  metrics.error_rate_percent
                    ?.toFixed(2)
                }
                unit="%"
                status={
                  metrics.error_rate_percent > 5
                    ? "High errors"
                    : "Normal"
                }
                danger={
                  metrics.error_rate_percent > 5
                }
              />

            </div>


            {/* =================================================
                AI INTELLIGENCE
            ================================================= */}

            <div className="section-title">

              <div>

                <h2>
                  AI Intelligence
                </h2>

                <p>
                  Real-time analysis from your
                  predictive engine
                </p>

              </div>

            </div>


            <div className="ai-grid">


              {/* ANOMALY */}

              <div className="ai-card">

                <div className="ai-card-header">

                  <Brain size={22} />

                  <span>
                    AI Anomaly Detection
                  </span>

                </div>


                <div
                  className={
                    ai.anomaly
                      ? "ai-value danger-text"
                      : "ai-value"
                  }
                >

                  {ai.anomaly
                    ? "ANOMALY"
                    : "NORMAL"}

                </div>


                <p>

                  Score:{" "}

                  {Number(
                    ai.anomaly_score || 0
                  ).toFixed(4)}

                </p>

              </div>


              {/* RISK */}

              <div className="ai-card">

                <div className="ai-card-header">

                  <Zap size={22} />

                  <span>
                    Predictive Risk
                  </span>

                </div>


                <div
                  className={
                    ai.prediction?.risk === "HIGH"
                      ? "risk-value danger-text"
                      : "risk-value"
                  }
                >

                  {ai.prediction?.risk ||
                    "LOW"}

                </div>


                <p>

                  Risk Score:{" "}

                  {ai.prediction?.risk_score ??
                    0}

                </p>

              </div>


              {/* SELF HEALING */}

              <div className="ai-card">

                <div className="ai-card-header">

                  <ShieldCheck size={22} />

                  <span>
                    Self-Healing
                  </span>

                </div>


                <div
                  className={
                    healing.status ===
                    "ACTION_EXECUTED"

                      ? "ai-value"

                      : healing.status ===
                        "ACTION_FAILED"

                      ? "risk-value danger-text"

                      : "ai-value"
                  }
                >

                  {formatHealingStatus(
                    healing.status
                  )}

                </div>


                <p>

                  {healing.action ||
                    "Monitoring recovery engine"}

                </p>

              </div>

            </div>


            {/* =================================================
                ROOT CAUSE
            ================================================= */}

            <div className="analysis-grid">


              <div className="analysis-card">

                <div className="analysis-header">

                  <AlertTriangle
                    size={19}
                  />

                  <span>
                    Root Cause Analysis
                  </span>

                </div>


                {ai.root_cause?.length > 0 ? (

                  <ul>

                    {ai.root_cause.map(
                      (cause, index) => (

                        <li key={index}>
                          {cause}
                        </li>

                      )
                    )}

                  </ul>

                ) : (

                  <p className="muted">
                    No active root cause detected.
                  </p>

                )}

              </div>


              <div className="analysis-card">

                <div className="analysis-header">

                  <Zap size={19} />

                  <span>
                    AI Recommendations
                  </span>

                </div>


                {ai.recommendations?.length > 0 ? (

                  <ul>

                    {ai.recommendations.map(
                      (recommendation, index) => (

                        <li key={index}>
                          {recommendation}
                        </li>

                      )
                    )}

                  </ul>

                ) : (

                  <p className="muted">
                    No recommendations required.
                  </p>

                )}

              </div>

            </div>


            {/* =================================================
                ARCHITECTURE
            ================================================= */}

            <div className="architecture">

              <div className="section-title">

                <div>

                  <h2>
                    APM Architecture
                  </h2>

                  <p>
                    Application monitoring and AI
                    processing pipeline
                  </p>

                </div>

              </div>


              <div className="architecture-flow">

                <ArchitectureBox
                  icon={<Server />}
                  title="Application"
                  text="Your application"
                />

                <ArrowRight />

                <ArchitectureBox
                  icon={<Activity />}
                  title="Monitoring"
                  text="Prometheus"
                />

                <ArrowRight />

                <ArchitectureBox
                  icon={<Brain />}
                  title="AI Engine"
                  text="ML + RCA"
                />

                <ArrowRight />

                <ArchitectureBox
                  icon={<ShieldCheck />}
                  title="Self-Healing"
                  text="Automatic recovery"
                />

              </div>

            </div>


            {/* =================================================
                INCIDENT
            ================================================= */}

            <div className="incident-preview">

              <div className="section-title">

                <div>

                  <h2>
                    Incident Management
                  </h2>

                  <p>
                    Monitor application incidents
                    and recovery
                  </p>

                </div>


                <button
                  className="secondary-button"
                  onClick={() =>
                    setActivePage(
                      "incidents"
                    )
                  }
                >

                  View Incidents

                </button>

              </div>


              <div className="empty-state">

                <AlertTriangle
                  size={35}
                />

                <h3>
                  Incident Management
                </h3>

                <p>
                  Incident management module will
                  be connected next.
                </p>

              </div>

            </div>


          </section>

        )}


        {/* =================================================
            OTHER PAGES
        ================================================= */}

        {activePage !== "dashboard" && (

          <section className="placeholder-page">

            <div className="placeholder-icon">

              <Activity size={40} />

            </div>


            <h2>

              {activePage
                .charAt(0)
                .toUpperCase() +
                activePage.slice(1)}

            </h2>


            <p>

              This module will be connected
              to the APM backend.

            </p>

          </section>

        )}

      </main>

    </div>

  );
}


// =========================================================
// NAV BUTTON
// =========================================================

function NavButton({
  icon,
  text,
  active,
  onClick,
}) {

  return (

    <button
      className={active ? "active" : ""}
      onClick={onClick}
    >

      {icon}

      {text}

    </button>

  );

}


// =========================================================
// METRIC CARD
// =========================================================

function MetricCard({
  icon,
  title,
  value,
  unit,
  status,
  danger,
}) {

  return (

    <div
      className={
        danger
          ? "metric-card danger-card"
          : "metric-card"
      }
    >

      <div className="metric-header">

        <div className="metric-icon">
          {icon}
        </div>

        <span>
          {title}
        </span>

      </div>


      <div className="metric-value">

        {value ?? "0"}

        <small>
          {unit}
        </small>

      </div>


      <div className="metric-status">

        <span
          className={
            danger
              ? "danger-dot"
              : ""
          }
        />

        {status}

      </div>

    </div>

  );

}


// =========================================================
// ARCHITECTURE BOX
// =========================================================

function ArchitectureBox({
  icon,
  title,
  text,
}) {

  return (

    <div className="architecture-box">

      <div className="architecture-icon">
        {icon}
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
// SELF HEALING STATUS
// =========================================================

function formatHealingStatus(status) {

  switch (status) {

    case "ACTION_EXECUTED":
      return "RECOVERED";

    case "ACTION_FAILED":
      return "FAILED";

    case "RECOMMENDATION":
      return "RECOMMENDED";

    case "NOT_REQUIRED":
      return "READY";

    default:
      return status || "READY";

  }

}


export default Dashboard;