import { useId, useState } from "react";
import { ArrowUpRight, ArrowRight, Cpu, MemoryStick, Timer, Activity, Plus, Brain, ShieldCheck, Server, Radio, Network, AlertTriangle, Check, Clock3 } from "lucide-react";

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const timeLabel = value => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function Overview({ metrics, ai, healing, services, agent, history, connected, loading, updatedAt, onNavigate, onInstall }) {
  const [windowMinutes, setWindowMinutes] = useState(5);
  const latest = history.at(-1);
  const points = history.filter(point => !latest || latest.time - point.time <= windowMinutes * 60000);
  const risk = ai?.prediction?.risk;
  const riskTone = !risk ? "neutral" : risk === "LOW" ? "mint" : risk === "MEDIUM" ? "amber" : "rose";
  const agentOnline = agent?.status === "ONLINE";
  const healthy = services?.filter(service => service.health === "HEALTHY").length;
  const cards = [
    { label: "CPU utilization", key: "cpu", icon: Cpu, color: "mint", threshold: 80, unit: "%", note: "Host processing capacity" },
    { label: "Memory usage", key: "memory", icon: MemoryStick, color: "blue", threshold: 80, unit: "%", note: "Physical memory in use" },
    { label: "Request latency", key: "latency", icon: Timer, color: "violet", threshold: 1000, unit: "ms", note: "Latest API response time" },
    { label: "Error rate", key: "errors", icon: Activity, color: "amber", threshold: 5, unit: "%", note: "Failed API requests" },
  ];
  return <div className="overview-page">
    <div className="overview-heading">
      <div><div className="overview-eyebrow"><span />YOUR SYSTEMS, IN FOCUS</div><h1>Environment overview<span>.</span></h1><p>A clear view of performance. An earlier signal when something changes.</p></div>
      <button className="workspace-primary" onClick={onInstall}><Plus size={17} />Install host agent</button>
    </div>
    {!connected && !loading && <div className="overview-notice" role="status"><AlertTriangle size={17} />The backend is unavailable. Displayed trends are from the last successful connection.</div>}
    <div className="overview-summary-strip">
      <span><i className={connected ? "summary-dot" : "summary-dot offline"} />{connected ? "Telemetry is streaming" : loading ? "Connecting to your environment" : "Telemetry disconnected"}</span>
      <div><span><Server size={14} />{services ? services.length : "—"} monitored {services?.length === 1 ? "entity" : "entities"}</span><span><Clock3 size={14} />Refreshes every 5s</span></div>
    </div>
    <div className="overview-metric-grid">{cards.map(card => <MetricCard key={card.key} {...card} value={latest?.[card.key]} available={Boolean(metrics)} values={history.map(point => point[card.key])} />)}</div>
    <div className="overview-main-grid">
      <section className="workspace-panel resource-panel">
        <div className="workspace-panel-heading"><div><h2>Resource utilization</h2><p>CPU and memory · live host readings</p></div><div className="chart-range" role="group" aria-label="Chart time window">{[1, 5].map(minutes => <button key={minutes} onClick={() => setWindowMinutes(minutes)} aria-pressed={windowMinutes === minutes} className={windowMinutes === minutes ? "selected" : ""}>{minutes}m</button>)}</div></div>
        <div className="resource-legend"><span><i className="legend-mint" />CPU <strong>{metrics ? number(latest?.cpu).toFixed(1) + "%" : "—"}</strong></span><span><i className="legend-blue" />Memory <strong>{metrics ? number(latest?.memory).toFixed(1) + "%" : "—"}</strong></span></div>
        <ResourceChart points={points} windowMinutes={windowMinutes} />
        <div className="chart-footnote"><Radio size={13} />{history.length > 1 ? "Live samples collected while this dashboard is open" : "Your chart will appear as live readings arrive"}</div>
      </section>
      <section className="workspace-panel intelligence-panel">
        <div className="intelligence-label"><span><Brain size={17} />PREDICTIVE INTELLIGENCE</span><span className="intelligence-spark">AI</span></div>
        <div className="risk-display">
          <div className={"risk-orbit tone-" + riskTone}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="49" className="risk-track" /><circle cx="60" cy="60" r="49" className="risk-progress" strokeDasharray={Math.min(100, number(ai?.prediction?.risk_score)) * 3.078 + " 308"} /></svg><div><strong>{ai ? number(ai.prediction?.risk_score).toFixed(0) : "—"}</strong><span>RISK SCORE</span></div></div>
          <div><span className={"workspace-badge " + riskTone}>{risk ? risk.toLowerCase() + " risk" : "Awaiting analysis"}</span><h3>{!ai ? "Listening for signals" : risk === "LOW" ? "Looking steady" : "A closer look needed"}</h3><p>{!ai ? "Analysis appears when the engine is connected." : risk === "LOW" ? "No significant performance risk predicted." : "The engine has identified elevated performance risk."}</p></div>
        </div>
        <div className="intelligence-rows"><div><span><Activity size={15} />Anomaly detection</span><strong className={!ai ? "" : ai.anomaly ? "tone-amber" : "tone-mint"}>{!ai ? "—" : ai.anomaly ? "Detected" : "Normal"}</strong></div><div><span><ShieldCheck size={15} />Self-healing</span><strong>{healing ? healingLabel(healing.status) : "—"}</strong></div></div>
        <button className="workspace-text-button" onClick={() => onNavigate("ai")}>Explore AI analysis<ArrowUpRight size={16} /></button>
      </section>
    </div>
    <div className="overview-bottom-grid">
      <section className="workspace-panel overview-services">
        <div className="workspace-panel-heading"><div><h2>Service health <span className="panel-count">{services?.length ?? "—"}</span></h2><p>{services ? healthy + " healthy · current service inventory" : "Waiting for the service inventory"}</p></div><button className="workspace-text-button" onClick={() => onNavigate("services")}>View service flow<ArrowUpRight size={15} /></button></div>
        <div className="overview-service-table-wrap"><table className="overview-service-table"><thead><tr><th>Service / host</th><th>Health</th><th>p95 latency</th><th>Requests</th></tr></thead><tbody>
          {services?.length ? services.slice(0, 5).map(service => <tr key={service.id}>
            <td><div className="service-identity"><span><Network size={17} /></span><div><strong>{service.name}</strong><small>{service.type} · {service.environment}</small></div></div></td>
            <td><span className={"workspace-badge " + ({ HEALTHY: "mint", WARNING: "amber", CRITICAL: "rose" }[service.health] || "neutral")}><i />{String(service.health || "Unknown").toLowerCase()}</span></td>
            <td>{number(service.metrics?.p95_latency_ms).toFixed(1)}<small> ms</small></td><td>{number(service.metrics?.request_count).toLocaleString()}</td>
          </tr>) : <tr><td colSpan="4"><div className="service-empty"><Network size={24} /><strong>{services ? "Your services will appear here" : "Service inventory unavailable"}</strong><p>{services ? "Connect your applications to start receiving telemetry." : "Check the backend connection to load service health."}</p></div></td></tr>}
        </tbody></table></div>
      </section>
      <section className="workspace-panel host-panel">
        <div className="host-panel-top"><span className="host-icon"><Server size={23} /></span><span className={"workspace-badge " + (agentOnline ? "mint" : "neutral")}>{agentOnline ? "Connected" : agent ? "Not connected" : "Unavailable"}</span></div>
        <h2>{agentOnline ? agent.hostname || "Host agent connected" : "Bring your hosts into view"}</h2>
        <p>{agentOnline ? "Your agent is sending host metrics and heartbeats to this workspace." : "Install the Windows agent to collect CPU, memory, network, and process metrics."}</p>
        <div className="host-benefits"><span><Check size={14} />Starts automatically at boot</span><span><Check size={14} />Runs as a Windows service</span></div>
        <button className="workspace-secondary" onClick={onInstall}>{agentOnline ? "Install on another host" : "Set up your agent"}<ArrowRight size={15} /></button>
      </section>
    </div>
    <footer className="overview-footer"><span><ShieldCheck size={14} />Predictive APM · Observe. Understand. Act.</span><span>{updatedAt ? "Last received " + timeLabel(updatedAt) : "Waiting for the first reading"}</span></footer>
  </div>;
}

function MetricCard({ label, value, unit, icon: Icon, color, threshold, note, values, available }) {
  const elevated = number(value) > threshold;
  return <article className={"overview-metric accent-" + color}>
    <div className="overview-metric-header"><span>{label}</span><span className="metric-glyph"><Icon size={18} /></span></div>
    <div className="overview-metric-reading"><strong>{available ? number(value).toFixed(1) : "—"}</strong><span>{unit}</span><span className={"metric-state " + (!available ? "neutral" : elevated ? "amber" : "mint")}>{!available ? "No data" : elevated ? "Elevated" : "Normal"}</span></div>
    <div className="metric-bottom"><small>{note}</small><Sparkline values={values} /></div>
  </article>;
}
function Sparkline({ values }) {
  if (values.length < 2) return <span className="sparkline-wait">Collecting trend</span>;
  const high = Math.max(...values, 1);
  const points = values.map((value, index) => (index / (values.length - 1) * 84).toFixed(1) + "," + (27 - Math.max(0, value) / high * 24).toFixed(1)).join(" ");
  return <svg className="metric-sparkline" viewBox="0 0 84 30" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
}
function ResourceChart({ points, windowMinutes }) {
  const gradientId = useId().replace(/:/g, "");
  const width = 680, height = 200;
  const end = points.at(-1)?.time || Date.now(), start = end - windowMinutes * 60000;
  const coordinates = key => points.map(point => [Math.max(0, (point.time - start) / (end - start) * width), height - Math.min(100, Math.max(0, point[key])) / 100 * height]);
  const cpu = coordinates("cpu"), memory = coordinates("memory");
  const line = values => values.map(([x, y]) => x.toFixed(2) + "," + y.toFixed(2)).join(" ");
  const area = cpu.length > 1 ? "M" + cpu[0][0] + "," + height + " L" + cpu.map(pair => pair.join(",")).join(" L") + " L" + cpu.at(-1)[0] + "," + height + " Z" : "";
  return <div className="resource-chart">
    <div className="chart-y-axis">{[100, 75, 50, 25, 0].map(value => <span key={value}>{value}%</span>)}</div>
    <div className="chart-plot">
      <svg viewBox={"0 0 " + width + " " + height} preserveAspectRatio="none" role="img" aria-label={"CPU and memory utilization over the last " + windowMinutes + " minutes. " + points.length + " live samples."}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#42dec0" stopOpacity=".25" /><stop offset="100%" stopColor="#42dec0" stopOpacity=".01" /></linearGradient></defs>
        {[0, 50, 100, 150, 200].map(y => <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="#263243" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
        {area && <path d={area} fill={"url(#" + gradientId + ")"} />}
        {points.length > 1 && <><polyline points={line(memory)} fill="none" stroke="#809dff" strokeWidth="2" vectorEffect="non-scaling-stroke" /><polyline points={line(cpu)} fill="none" stroke="#42dec0" strokeWidth="2" vectorEffect="non-scaling-stroke" /></>}
      </svg>
      {points.length < 2 && <span className="chart-collecting"><Radio size={16} />Collecting live readings…</span>}
      <div className="chart-x-axis"><span>{windowMinutes} min ago</span><span>{windowMinutes / 2} min ago</span><span>Now</span></div>
    </div>
  </div>;
}
function healingLabel(status) {
  return ({ ACTION_EXECUTED: "Recovered", ACTION_FAILED: "Needs attention", RECOMMENDATION: "Recommended", NOT_REQUIRED: "Ready", LOADING: "Processing" })[status] || status?.replaceAll("_", " ") || "Waiting";
}
