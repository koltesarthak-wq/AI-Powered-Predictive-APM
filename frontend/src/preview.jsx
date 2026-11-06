import { Activity, AlertTriangle, BarChart3, Brain, Gauge, Network, Server, ShieldCheck } from "lucide-react";

import ServiceFlow from "./ServiceFlow";

import "./App.css";


function Preview() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon"><Activity size={22} /></div>
          <div><h2>Predictive APM</h2><span>AI Monitoring Platform</span></div>
        </div>

        <nav>
          <button><BarChart3 size={19} />Dashboard</button>
          <button><Gauge size={19} />Application Monitoring</button>
          <button className="active"><Network size={19} />Service Flow</button>
          <button><Server size={19} />Applications</button>
          <button><AlertTriangle size={19} />Incidents</button>
          <button><Brain size={19} />AI Analysis</button>
          <button><ShieldCheck size={19} />Self-Healing</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot" />
            <div><strong>Demo Preview</strong><small>Sample telemetry</small></div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><h1>AI-Powered Predictive APM</h1><p>Service health and dependency monitoring</p></div>
          <div className="topbar-actions"><div className="connection-status"><span />Sample data</div><button className="profile">SK</button></div>
        </header>
        <ServiceFlow demoMode />
      </main>
    </div>
  );
}


export default Preview;
