import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Activity, LayoutDashboard, Gauge, Network, Server, AlertTriangle, Brain, ShieldCheck, RefreshCw, ChevronRight, Layers3, LogOut, Radio } from "lucide-react";
import Login from "./Login";
import Register from "./Register";
import ProtectedRoute from "./ProtectedRoute";
import Incidents from "./Incidents";
import Applications from "./Applications";
import AIAnalysis from "./AIAnalysis";
import SelfHealing from "./SelfHealing";
import ApplicationMonitoring from "./ApplicationMonitoring";
import ServiceFlow from "./ServiceFlow";
import Overview from "./Overview";
import { getSystemMetrics, getAIAnalysis, getSelfHealing, getServices, getAgentStatus, logoutUser } from "./api";
import "./App.css";
import "./AIAnalysis.css";
import "./Applications.css";
import "./Incidents.css";
import "./SelfHealing.css";
import "./ApplicationMonitoring.css";
import "./Workspace.css";

const navigation = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard, group: "Monitor" },
  { id: "monitoring", label: "Application Monitoring", icon: Gauge, group: "Monitor" },
  { id: "services", label: "Service Flow", icon: Network, group: "Monitor" },
  { id: "applications", label: "Applications", icon: Server, group: "Monitor" },
  { id: "incidents", label: "Incidents", icon: AlertTriangle, group: "Intelligence" },
  { id: "ai", label: "AI Analysis", icon: Brain, group: "Intelligence" },
  { id: "healing", label: "Self-Healing", icon: ShieldCheck, group: "Intelligence" },
];

export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/dashboard" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}

function Workspace() {
  const [activePage, setActivePage] = useState("dashboard");
  const [installerOpen, setInstallerOpen] = useState(false);
  const [data, setData] = useState({ metrics: null, ai: null, healing: null, services: null, agent: null });
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const results = await Promise.allSettled([getSystemMetrics(), getAIAnalysis(), getSelfHealing(), getServices(), getAgentStatus()]);
      if (!mounted.current) return;
      const [metrics, ai, healing, services, agent] = results.map(r => r.status === "fulfilled" ? r.value : null);
      setData({ metrics, ai, healing: healing?.self_healing || null, services: services?.services || null, agent });
      setConnected(Boolean(metrics));
      if (metrics) {
        const time = Date.now();
        setUpdatedAt(new Date(time));
        setHistory(previous => [...previous.filter(point => time - point.time <= 300000), {
          time, cpu: Number(metrics.cpu_usage_percent || 0), memory: Number(metrics.memory_usage_percent || 0),
          latency: Number(metrics.latency_seconds || 0) * 1000, errors: Number(metrics.error_rate_percent || 0),
        }].slice(-61));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => { mounted.current = false; clearInterval(interval); };
  }, []);
  function navigate(page) { setInstallerOpen(false); setActivePage(page); }
  function installAgent() { setInstallerOpen(true); setActivePage("monitoring"); }
  return <div className="app workspace">
    <aside className="sidebar workspace-sidebar">
      <a className="workspace-brand" href="/dashboard" aria-label="Predictive APM home">
        <span className="workspace-mark"><Activity size={24} strokeWidth={2.4} /></span>
        <span className="brand-copy"><strong>Predictive<span>APM</span></strong><small>OBSERVABILITY PLATFORM</small></span>
      </a>
      <div className="workspace-environment"><span className="environment-icon"><Layers3 size={18} /></span><div><strong>Your workspace</strong><small>Application observability</small></div><span className="environment-dot" /></div>
      <nav className="workspace-nav" aria-label="Main navigation">
        {["Monitor", "Intelligence"].map(group => <div className="nav-group" key={group}>
          <span className="nav-group-label">{group}</span>
          {navigation.filter(item => item.group === group).map(({ id, label, icon: Icon }) => <button key={id}
            className={activePage === id ? "active" : ""} onClick={() => navigate(id)} title={label} aria-label={label} aria-current={activePage === id ? "page" : undefined}>
            <Icon size={18} /><span>{label}</span>{activePage === id && <span className="nav-active-indicator" />}
          </button>)}
        </div>)}
      </nav>
      <div className="workspace-sidebar-bottom">
        <div className="workspace-connection"><Radio size={18} className={connected ? "tone-mint" : "tone-amber"} /><div><strong>{connected ? "Connected to backend" : loading ? "Connecting…" : "Backend unavailable"}</strong><small>Auto-refresh every 5 seconds</small></div></div>
        <button className="workspace-signout" onClick={logoutUser} title="Sign out"><LogOut size={17} /><span>Sign out</span></button>
        <span className="workspace-version">PREDICTIVE APM <span>v1.0</span></span>
      </div>
    </aside>
    <main className="main workspace-main">
      <header className="topbar workspace-topbar">
        <div className="workspace-breadcrumb"><Layers3 size={16} /><span>Workspace</span><ChevronRight size={13} /><strong>{navigation.find(item => item.id === activePage).label}</strong></div>
        <div className="workspace-topbar-actions"><span className={"workspace-live " + (connected ? "" : "is-offline")}><i />{connected ? "Live connection" : "Disconnected"}</span>
          <button className="workspace-icon-button" onClick={refresh} disabled={loading} title="Refresh dashboard" aria-label="Refresh dashboard"><RefreshCw size={17} className={loading ? "workspace-spin" : ""} /></button>
        </div>
      </header>
      {activePage === "dashboard" && <Overview {...data} history={history} connected={connected} loading={loading} updatedAt={updatedAt} onNavigate={navigate} onInstall={installAgent} />}
      {activePage === "monitoring" && <ApplicationMonitoring initialDeployOpen={installerOpen} />}
      {activePage === "services" && <ServiceFlow />}
      {activePage === "applications" && <Applications />}
      {activePage === "incidents" && <Incidents />}
      {activePage === "ai" && <AIAnalysis />}
      {activePage === "healing" && <SelfHealing />}
    </main>
  </div>;
}
