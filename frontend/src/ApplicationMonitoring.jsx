import React, {
    useEffect,
    useRef,
    useState
} from "react";

import {
    Activity,
    BarChart3,
    CheckCircle,
    Clock,
    AlertTriangle,
    RefreshCw,
    Server,
    TrendingUp,
    Zap,
    Download,
    X,
    Package,
    Monitor,
    Settings
} from "lucide-react";

import {
    getApplicationMonitoring,
    getApplicationEndpoints,
    deployAgent,
    getAgentStatus,
    API_BASE_URL
} from "./api";

import "./ApplicationMonitoring.css";


function ApplicationMonitoring({ initialDeployOpen = false }) {

    const deployDialogRef = useRef(null);

    // ========================================================
    // MONITORING STATE
    // ========================================================

    const [monitoring, setMonitoring] = useState(null);

    const [endpoints, setEndpoints] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [lastUpdated, setLastUpdated] =
        useState(null);

    const [history, setHistory] = useState([]);


    // ========================================================
    // AGENT STATE
    // ========================================================

    const [agentStatus, setAgentStatus] =
        useState(null);


    // ========================================================
    // DEPLOYMENT STATE
    // ========================================================

    const [showDeployModal, setShowDeployModal] =
        useState(initialDeployOpen);

    const [deploying, setDeploying] =
        useState(false);

    const [deployment, setDeployment] =
        useState(null);

    const [deploymentError, setDeploymentError] =
        useState("");


    const [deployConfig, setDeployConfig] =
        useState({

            agent_name:
                "AI-Predictive-APM-Agent",

            operating_system:
                "Windows",

            backend_url:
                API_BASE_URL,

            collection_interval:
                5
        });


    // ========================================================
    // LOAD MONITORING DATA
    // ========================================================

    const loadMonitoring = async () => {

        try {

            setError("");

            const [
                monitoringData,
                endpointData,
                agentData
            ] = await Promise.all([
                getApplicationMonitoring(),
                getApplicationEndpoints(),
                getAgentStatus()
            ]);


            setMonitoring(
                monitoringData
            );


            if (
                Array.isArray(
                    endpointData
                )
            ) {

                setEndpoints(
                    endpointData
                );

            } else {

                setEndpoints(
                    endpointData.endpoints || []
                );
            }


            setAgentStatus(
                agentData
            );


            setLastUpdated(
                new Date()
            );


            // =================================================
            // HISTORY
            // =================================================

            const health =
                monitoringData?.health;

            const performance =
                monitoringData?.performance;

            const ai =
                monitoringData?.ai_integration;


            const reading = {

                timestamp:
                    new Date(),

                requests:
                    Number(
                        monitoringData?.requests?.total ||
                        monitoringData?.requests?.count ||
                        0
                    ),

                latency:
                    Number(
                        performance?.average_latency ||
                        performance?.latency ||
                        0
                    ),

                errorRate:
                    Number(
                        performance?.error_rate ||
                        monitoringData?.requests?.error_rate ||
                        0
                    ),

                risk:
                    Number(
                        ai?.risk_score ||
                        ai?.risk ||
                        0
                    )
            };


            setHistory(
                previous => [
                    ...previous,
                    reading
                ].slice(-20)
            );


        } catch (err) {

            console.error(
                "Application monitoring error:",
                err
            );

            setError(
                err.message ||
                "Unable to load application monitoring data."
            );

        } finally {

            setLoading(false);
        }
    };


    // ========================================================
    // INITIAL LOAD + POLLING
    // ========================================================

    useEffect(() => {

        loadMonitoring();

        const interval =
            setInterval(
                loadMonitoring,
                5000
            );

        return () =>
            clearInterval(interval);

    }, []);

    useEffect(() => {
        if (!showDeployModal || loading) return;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        deployDialogRef.current?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [showDeployModal, loading]);


    // ========================================================
    // OPEN DEPLOY MODAL
    // ========================================================

    const openDeployModal = () => {

        setDeployment(null);

        setDeploymentError("");

        setDeployConfig({

            agent_name:
                "AI-Predictive-APM-Agent",

            operating_system:
                "Windows",

            backend_url:
                API_BASE_URL,

            collection_interval:
                5
        });

        setShowDeployModal(true);
    };


    // ========================================================
    // CLOSE DEPLOY MODAL
    // ========================================================

    const closeDeployModal = () => {

        if (deploying) {
            return;
        }

        setShowDeployModal(false);

        setDeployment(null);

        setDeploymentError("");
    };


    // ========================================================
    // CONFIG CHANGE
    // ========================================================

    const handleConfigChange = (
        event
    ) => {

        const {
            name,
            value
        } = event.target;


        setDeployConfig(
            previous => ({
                ...previous,
                [name]:
                    name === "collection_interval"
                        ? Number(value)
                        : value
            })
        );
    };


    // ========================================================
    // DEPLOY AGENT
    // ========================================================

    const handleDeploy = async (
        event
    ) => {

        event.preventDefault();

        setDeploying(true);

        setDeployment(null);

        setDeploymentError("");


        try {

            const result =
                await deployAgent(
                    deployConfig
                );


            const deploymentData =
                result?.deployment ||
                result;


            if (deploymentData.package_type !== "exe") {
                throw new Error("Restart the FastAPI backend to load Windows installer support, then create the installer again.");
            }
            setDeployment(deploymentData);


        } catch (err) {

            console.error(
                "Agent deployment failed:",
                err
            );

            setDeploymentError(
                err.message ||
                "Failed to build the Windows installer."
            );

        } finally {

            setDeploying(false);
        }
    };


    // ========================================================
    // DOWNLOAD PACKAGE
    // ========================================================

    const downloadPackage = () => {

        if (!deployment) {
            return;
        }


        const endpoint =
            deployment.download_endpoint;


        if (!endpoint) {

            setDeploymentError(
                "Download endpoint was not returned by the backend."
            );

            return;
        }


        window.location.href =
            `${API_BASE_URL}${endpoint}`;
    };


    // ========================================================
    // HELPERS
    // ========================================================

    const formatNumber = (
        value
    ) => {

        const number =
            Number(value || 0);

        return number.toLocaleString();
    };


    const formatPercent = (
        value
    ) => {

        const number =
            Number(value || 0);

        return `${number.toFixed(2)}%`;
    };


    const formatLatency = (
        value
    ) => {

        const number =
            Number(value || 0);

        return `${number.toFixed(2)} ms`;
    };


    const formatTime = (
        date
    ) => {

        if (!date) {
            return "--";
        }

        return date.toLocaleTimeString();
    };


    // ========================================================
    // LOADING
    // ========================================================

    if (
        loading &&
        !monitoring
    ) {

        return (
            <div className="application-monitoring-page">

                <div className="monitor-loading">

                    <div className="monitor-spinner" />

                    <p>
                        Loading application monitoring...
                    </p>

                </div>

            </div>
        );
    }


    // ========================================================
    // SAFE DATA
    // ========================================================

    const health =
        monitoring?.health || {};

    const requests =
        monitoring?.requests || {};

    const performance =
        monitoring?.performance || {};

    const ai =
        monitoring?.ai_integration || {};

    const agent =
        monitoring?.agent || {};


    const totalRequests =
        requests.total ||
        requests.count ||
        0;


    const totalErrors =
        requests.errors ||
        requests.error_count ||
        0;


    const latency =
        performance.average_latency ||
        performance.latency ||
        0;


    const errorRate =
        performance.error_rate ||
        requests.error_rate ||
        0;


    const riskScore =
        ai.risk_score ||
        ai.risk ||
        0;


    const anomaly =
        ai.anomaly ||
        ai.status ||
        false;


    const agentOnline =
        agentStatus?.status === "ONLINE" ||
        agentStatus?.status === "online" ||
        agent?.status === "ONLINE" ||
        agent?.status === "online";


    // ========================================================
    // RENDER
    // ========================================================

    return (

        <div className="application-monitoring-page">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="monitor-header">

                <div>

                    <div className="monitor-title-row">

                        <Activity size={28} />

                        <h1>
                            Application Monitoring
                        </h1>

                        <span className="live-badge">
                            <span className="live-dot" />
                            LIVE
                        </span>

                    </div>

                    <p>
                        Real-time application performance,
                        endpoint and AI health monitoring
                    </p>

                </div>


                <div className="monitor-header-actions">

                    <button
                        className="deploy-agent-button"
                        onClick={openDeployModal}
                    >

                        <Download size={17} />

                        Install Host Agent

                    </button>


                    <button
                        className="monitor-refresh-button"
                        onClick={loadMonitoring}
                    >

                        <RefreshCw size={17} />

                        Refresh

                    </button>

                </div>

            </div>


            {/* =================================================
                ERROR
            ================================================= */}

            {error && (

                <div className="monitor-error">

                    <AlertTriangle size={18} />

                    <span>
                        {error}
                    </span>

                </div>
            )}


            {/* =================================================
                OVERVIEW
            ================================================= */}

            <section>

                <div className="section-heading">

                    <div>

                        <h2>
                            Application Overview
                        </h2>

                        <p>
                            Current application health
                            and performance
                        </p>

                    </div>

                </div>


                <div className="monitor-overview-grid">

                    <MonitorStatCard
                        title="Application Health"
                        value={
                            health.status ||
                            health.health ||
                            "Healthy"
                        }
                        icon={
                            <CheckCircle size={22} />
                        }
                        status={
                            String(
                                health.status ||
                                health.health ||
                                "healthy"
                            ).toLowerCase()
                        }
                    />


                    <MonitorStatCard
                        title="Total Requests"
                        value={
                            formatNumber(
                                totalRequests
                            )
                        }
                        icon={
                            <Activity size={22} />
                        }
                    />


                    <MonitorStatCard
                        title="Errors"
                        value={
                            formatNumber(
                                totalErrors
                            )
                        }
                        icon={
                            <AlertTriangle size={22} />
                        }
                        danger={
                            Number(totalErrors) > 0
                        }
                    />


                    <MonitorStatCard
                        title="Average Latency"
                        value={
                            formatLatency(
                                latency
                            )
                        }
                        icon={
                            <Clock size={22} />
                        }
                    />

                </div>

            </section>


            {/* =================================================
                SECONDARY STATUS
            ================================================= */}

            <div className="secondary-status-grid">

                <div className="secondary-status-card">

                    <div className="secondary-status-icon">

                        <Zap size={20} />

                    </div>

                    <div>

                        <span>
                            AI Anomaly
                        </span>

                        <strong>
                            {typeof anomaly === "boolean"
                                ? anomaly
                                    ? "Detected"
                                    : "Normal"
                                : anomaly || "Normal"}
                        </strong>

                    </div>

                </div>


                <div className="secondary-status-card">

                    <div className="secondary-status-icon">

                        <TrendingUp size={20} />

                    </div>

                    <div>

                        <span>
                            AI Risk Score
                        </span>

                        <strong>
                            {Number(
                                riskScore
                            ).toFixed(2)}
                        </strong>

                    </div>

                </div>


                <div className="secondary-status-card">

                    <div className="secondary-status-icon">

                        <Server size={20} />

                    </div>

                    <div>

                        <span>
                            Monitoring Agent
                        </span>

                        <strong
                            className={
                                agentOnline
                                    ? "status-online"
                                    : "status-offline"
                            }
                        >
                            {agentOnline
                                ? "ONLINE"
                                : "OFFLINE"}
                        </strong>

                    </div>

                </div>

            </div>


            {/* =================================================
                PERFORMANCE TRENDS
            ================================================= */}

            <section>

                <div className="section-heading">

                    <div>

                        <h2>
                            Performance Trends
                        </h2>

                        <p>
                            Live application performance
                            over recent readings
                        </p>

                    </div>

                </div>


                <div className="performance-trend-grid">

                    <TrendChart
                        title="Request Volume"
                        icon={
                            <BarChart3 size={18} />
                        }
                        values={
                            history.map(
                                item =>
                                    item.requests
                            )
                        }
                        suffix=""
                    />


                    <TrendChart
                        title="Average Latency"
                        icon={
                            <Clock size={18} />
                        }
                        values={
                            history.map(
                                item =>
                                    item.latency
                            )
                        }
                        suffix=" ms"
                    />


                    <TrendChart
                        title="Error Rate"
                        icon={
                            <AlertTriangle size={18} />
                        }
                        values={
                            history.map(
                                item =>
                                    item.errorRate
                            )
                        }
                        suffix="%"
                    />


                    <TrendChart
                        title="AI Risk Score"
                        icon={
                            <Zap size={18} />
                        }
                        values={
                            history.map(
                                item =>
                                    item.risk
                            )
                        }
                        suffix=""
                    />

                </div>

            </section>


            {/* =================================================
                ENDPOINT MONITORING
            ================================================= */}

            <section className="endpoint-section">

                <div className="section-heading">

                    <div>

                        <h2>
                            Endpoint Performance
                        </h2>

                        <p>
                            Request-level application
                            performance
                        </p>

                    </div>

                </div>


                <div className="endpoint-table-wrapper">

                    {endpoints.length === 0 ? (

                        <div className="monitor-empty">

                            <Activity size={30} />

                            <p>
                                No endpoint data available yet.
                            </p>

                        </div>

                    ) : (

                        <table className="endpoint-table">

                            <thead>

                                <tr>

                                    <th>
                                        Method
                                    </th>

                                    <th>
                                        Endpoint
                                    </th>

                                    <th>
                                        Requests
                                    </th>

                                    <th>
                                        Errors
                                    </th>

                                    <th>
                                        Error Rate
                                    </th>

                                    <th>
                                        Avg Latency
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {endpoints.map(
                                    (
                                        endpoint,
                                        index
                                    ) => {

                                        const endpointErrorRate =
                                            endpoint.error_rate ||
                                            0;

                                        const endpointLatency =
                                            endpoint.average_latency ||
                                            endpoint.avg_latency ||
                                            endpoint.latency ||
                                            0;

                                        const endpointErrors =
                                            endpoint.errors ||
                                            endpoint.error_count ||
                                            0;

                                        const endpointRequests =
                                            endpoint.requests ||
                                            endpoint.request_count ||
                                            0;

                                        const unhealthy =
                                            Number(
                                                endpointErrorRate
                                            ) > 5 ||
                                            Number(
                                                endpointLatency
                                            ) > 1000;


                                        return (

                                            <tr
                                                key={
                                                    `${endpoint.endpoint || "endpoint"}-${index}`
                                                }
                                            >

                                                <td>

                                                    <span className="method-badge">

                                                        {
                                                            endpoint.method ||
                                                            "GET"
                                                        }

                                                    </span>

                                                </td>


                                                <td>

                                                    <span className="endpoint-name">

                                                        {
                                                            endpoint.endpoint ||
                                                            endpoint.path ||
                                                            "/"
                                                        }

                                                    </span>

                                                </td>


                                                <td>

                                                    {formatNumber(
                                                        endpointRequests
                                                    )}

                                                </td>


                                                <td>

                                                    {formatNumber(
                                                        endpointErrors
                                                    )}

                                                </td>


                                                <td>

                                                    {formatPercent(
                                                        endpointErrorRate
                                                    )}

                                                </td>


                                                <td>

                                                    {formatLatency(
                                                        endpointLatency
                                                    )}

                                                </td>


                                                <td>

                                                    <span
                                                        className={
                                                            unhealthy
                                                                ? "endpoint-status status-warning"
                                                                : "endpoint-status status-good"
                                                        }
                                                    >

                                                        {unhealthy
                                                            ? "Attention"
                                                            : "Healthy"}

                                                    </span>

                                                </td>

                                            </tr>
                                        );
                                    }
                                )}

                            </tbody>

                        </table>
                    )}

                </div>

            </section>


            {/* =================================================
                HIGHLIGHTS
            ================================================= */}

            <section>

                <div className="endpoint-highlights-grid">

                    <EndpointHighlight
                        title="Top Endpoints"
                        icon={
                            <TrendingUp size={19} />
                        }
                        endpoints={
                            [...endpoints]
                                .sort(
                                    (
                                        a,
                                        b
                                    ) =>
                                        Number(
                                            b.requests ||
                                            0
                                        ) -
                                        Number(
                                            a.requests ||
                                            0
                                        )
                                )
                                .slice(
                                    0,
                                    5
                                )
                        }
                        metric="requests"
                    />


                    <EndpointHighlight
                        title="Slowest Endpoints"
                        icon={
                            <Clock size={19} />
                        }
                        endpoints={
                            [...endpoints]
                                .sort(
                                    (
                                        a,
                                        b
                                    ) =>
                                        Number(
                                            b.average_latency ||
                                            b.avg_latency ||
                                            b.latency ||
                                            0
                                        ) -
                                        Number(
                                            a.average_latency ||
                                            a.avg_latency ||
                                            a.latency ||
                                            0
                                        )
                                )
                                .slice(
                                    0,
                                    5
                                )
                        }
                        metric="latency"
                    />


                    <EndpointHighlight
                        title="Error-Prone Endpoints"
                        icon={
                            <AlertTriangle size={19} />
                        }
                        endpoints={
                            [...endpoints]
                                .sort(
                                    (
                                        a,
                                        b
                                    ) =>
                                        Number(
                                            b.error_rate ||
                                            0
                                        ) -
                                        Number(
                                            a.error_rate ||
                                            0
                                        )
                                )
                                .slice(
                                    0,
                                    5
                                )
                        }
                        metric="error_rate"
                    />

                </div>

            </section>


            {/* =================================================
                FOOTER
            ================================================= */}

            <div className="monitor-footer">

                <span>

                    Last updated:
                    {" "}
                    {formatTime(
                        lastUpdated
                    )}

                </span>

                <span>

                    Auto-refresh:
                    {" "}
                    5 seconds

                </span>

            </div>


            {/* =================================================
                DEPLOY AGENT MODAL
            ================================================= */}

            {showDeployModal && (

                <div
                    className="deploy-modal-overlay"
                    onMouseDown={closeDeployModal}
                >

                    <div
                        className="deploy-modal"
                        ref={deployDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="agent-install-title"
                        tabIndex={-1}
                        onKeyDown={event => {
                            if (event.key === "Escape") closeDeployModal();
                            if (event.key !== "Tab") return;
                            const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")];
                            const first = controls[0];
                            const last = controls.at(-1);
                            if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
                                event.preventDefault();
                                last?.focus();
                            } else if (!event.shiftKey && document.activeElement === last) {
                                event.preventDefault();
                                first?.focus();
                            }
                        }}
                        onMouseDown={
                            event =>
                                event.stopPropagation()
                        }
                    >

                        {/* HEADER */}

                        <div className="deploy-modal-header">

                            <div className="deploy-modal-title">

                                <div className="deploy-modal-icon">

                                    <Package size={23} />

                                </div>

                                <div>

                                    <h2 id="agent-install-title">
                                        Install Windows Host Agent
                                    </h2>

                                    <p>
                                        Download, open and install. Your host connects automatically.
                                    </p>

                                </div>

                            </div>


                            <button
                                className="deploy-close-button"
                                aria-label="Close agent installer"
                                onClick={
                                    closeDeployModal
                                }
                                disabled={deploying}
                            >

                                <X size={20} />

                            </button>

                        </div>


                        {!deployment && (

                            <form
                                className="deploy-form"
                                onSubmit={
                                    handleDeploy
                                }
                            >

                                {/* AGENT NAME */}

                                <div className="deploy-field">

                                    <label htmlFor="agent-name">
                                        Agent Name
                                    </label>

                                    <input
                                        type="text"
                                        id="agent-name"
                                        name="agent_name"
                                        value={
                                            deployConfig.agent_name
                                        }
                                        onChange={
                                            handleConfigChange
                                        }
                                        required
                                        maxLength={100}
                                    />

                                </div>


                                {/* OS */}

                                <div className="deploy-field">

                                    <label htmlFor="agent-os">
                                        Operating System
                                    </label>

                                    <select
                                        id="agent-os"
                                        name="operating_system"
                                        value={
                                            deployConfig.operating_system
                                        }
                                        onChange={
                                            handleConfigChange
                                        }
                                    >

                                        <option value="Windows">
                                            Windows
                                        </option>

                                    </select>

                                </div>


                                {/* BACKEND URL */}

                                <div className="deploy-field">

                                    <label htmlFor="agent-backend-url">
                                        Backend URL
                                    </label>

                                    <input
                                        type="url"
                                        id="agent-backend-url"
                                        name="backend_url"
                                        value={
                                            deployConfig.backend_url
                                        }
                                        onChange={
                                            handleConfigChange
                                        }
                                        required
                                    />

                                    <small>

                                        Use 127.0.0.1 only when
                                        the agent runs on the same
                                        machine as the backend.

                                    </small>

                                </div>


                                {/* INTERVAL */}

                                <div className="deploy-field">

                                    <label htmlFor="agent-interval">
                                        Collection Interval
                                    </label>

                                    <div className="interval-input">

                                        <input
                                            type="number"
                                            id="agent-interval"
                                            name="collection_interval"
                                            min="1"
                                            max="3600"
                                            value={
                                                deployConfig.collection_interval
                                            }
                                            onChange={
                                                handleConfigChange
                                            }
                                            required
                                        />

                                        <span>
                                            seconds
                                        </span>

                                    </div>

                                </div>


                                {/* INFO */}

                                <div className="deploy-info-box">

                                    <Settings size={18} />

                                    <div>

                                        <strong>
                                            Runs as a Windows service
                                        </strong>

                                        <p>

                                            The installer starts the
                                            agent now, starts it again
                                            after each reboot, and asks
                                            Windows to restart it after
                                            a service failure.

                                        </p>

                                    </div>

                                </div>


                                {/* ERROR */}

                                {deploymentError && (

                                    <div className="deploy-error">

                                        <AlertTriangle
                                            size={17}
                                        />

                                        {deploymentError}

                                    </div>
                                )}


                                {/* BUTTONS */}

                                <div className="deploy-modal-actions">

                                    <button
                                        type="button"
                                        className="deploy-cancel-button"
                                        onClick={
                                            closeDeployModal
                                        }
                                        disabled={
                                            deploying
                                        }
                                    >
                                        Cancel
                                    </button>


                                    <button
                                        type="submit"
                                        className="deploy-submit-button"
                                        disabled={
                                            deploying
                                        }
                                    >

                                        {deploying ? (

                                            <>
                                                <span className="deploy-button-spinner" />
                                                Building installer...
                                            </>

                                        ) : (

                                            <>
                                                <Package
                                                    size={18}
                                                />
                                                Create Windows Installer
                                            </>
                                        )}

                                    </button>

                                </div>

                            </form>
                        )}


                        {/* =================================================
                            SUCCESS
                        ================================================= */}

                        {deployment && (

                            <div className="deployment-success">

                                <div className="deployment-success-icon">

                                    <CheckCircle size={36} />

                                </div>

                                <h2>
                                    Windows Installer Ready
                                </h2>

                                <p>
                                    Your configured host agent is
                                    ready to install as a Windows
                                    service.
                                </p>


                                <div className="deployment-details">

                                    <div>

                                        <span>
                                            Agent
                                        </span>

                                        <strong>
                                            {
                                                deployment.agent_name ||
                                                deployConfig.agent_name
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Operating System
                                        </span>

                                        <strong>
                                            {
                                                deployment.operating_system ||
                                                deployConfig.operating_system
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Backend
                                        </span>

                                        <strong>
                                            {
                                                deployment.backend_url ||
                                                deployConfig.backend_url
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Collection Interval
                                        </span>

                                        <strong>
                                            {
                                                deployment.collection_interval ||
                                                deployConfig.collection_interval
                                            }
                                            {" "}
                                            seconds
                                        </strong>

                                    </div>

                                </div>


                                <div className="deployment-install-note">

                                    <Monitor size={19} />

                                    <div>

                                        <strong>
                                            Install on the target host
                                        </strong>

                                        <p>

                                            Download and double-click the
                                            <b> .exe installer</b>. Approve
                                            the Windows permission prompt,
                                            then click Install. The agent
                                            starts now and after every reboot.
                                            Return here to see live host readings.

                                        </p>

                                    </div>

                                </div>


                                {deploymentError && (

                                    <div className="deploy-error">

                                        <AlertTriangle
                                            size={17}
                                        />

                                        {deploymentError}

                                    </div>
                                )}


                                <div className="deploy-modal-actions">

                                    <button
                                        type="button"
                                        className="deploy-cancel-button"
                                        onClick={
                                            closeDeployModal
                                        }
                                    >
                                        Close
                                    </button>


                                    <button
                                        type="button"
                                        className="deploy-submit-button"
                                        onClick={
                                            downloadPackage
                                        }
                                    >

                                        <Download
                                            size={18}
                                        />

                                        Download Installer (.exe)

                                    </button>

                                </div>

                            </div>
                        )}

                    </div>

                </div>
            )}

        </div>
    );
}


// ============================================================
// STAT CARD
// ============================================================

function MonitorStatCard({
    title,
    value,
    icon,
    status,
    danger
}) {

    return (

        <div
            className={
                `monitor-stat-card ${
                    danger
                        ? "stat-danger"
                        : ""
                }`
            }
        >

            <div className="stat-card-top">

                <span>
                    {title}
                </span>

                <div className="stat-card-icon">
                    {icon}
                </div>

            </div>

            <strong
                className={
                    status
                        ? `health-${status}`
                        : ""
                }
            >
                {value}
            </strong>

        </div>
    );
}


// ============================================================
// TREND CHART
// ============================================================

function TrendChart({
    title,
    icon,
    values,
    suffix
}) {

    const safeValues =
        values.length
            ? values
            : [0];


    const max =
        Math.max(
            ...safeValues,
            1
        );


    return (

        <div className="trend-card">

            <div className="trend-card-header">

                <div>

                    {icon}

                    <span>
                        {title}
                    </span>

                </div>


                <strong>

                    {
                        Number(
                            safeValues[
                                safeValues.length - 1
                            ] || 0
                        ).toFixed(2)
                    }

                    {suffix}

                </strong>

            </div>


            <div className="trend-chart">

                {safeValues.map(
                    (
                        value,
                        index
                    ) => {

                        const height =
                            Math.max(
                                5,
                                (
                                    Number(value) /
                                    max
                                ) * 100
                            );


                        return (

                            <div
                                key={index}
                                className="trend-bar"
                                style={{
                                    height:
                                        `${height}%`
                                }}
                                title={
                                    `${value}${suffix}`
                                }
                            />

                        );
                    }
                )}

            </div>

        </div>
    );
}


// ============================================================
// ENDPOINT HIGHLIGHT
// ============================================================

function EndpointHighlight({
    title,
    icon,
    endpoints,
    metric
}) {

    return (

        <div className="endpoint-highlight-card">

            <div className="highlight-header">

                <div>

                    {icon}

                    <h3>
                        {title}
                    </h3>

                </div>

            </div>


            {endpoints.length === 0 ? (

                <div className="highlight-empty">
                    No data
                </div>

            ) : (

                <div className="highlight-list">

                    {endpoints.map(
                        (
                            endpoint,
                            index
                        ) => {

                            let value = 0;

                            if (
                                metric === "requests"
                            ) {

                                value =
                                    endpoint.requests ||
                                    endpoint.request_count ||
                                    0;

                            } else if (
                                metric === "latency"
                            ) {

                                value =
                                    endpoint.average_latency ||
                                    endpoint.avg_latency ||
                                    endpoint.latency ||
                                    0;

                            } else {

                                value =
                                    endpoint.error_rate ||
                                    0;
                            }


                            return (

                                <div
                                    className="highlight-item"
                                    key={
                                        `${endpoint.endpoint || "endpoint"}-${index}`
                                    }
                                >

                                    <span>

                                        {endpoint.method ||
                                            "GET"}

                                        {" "}

                                        {
                                            endpoint.endpoint ||
                                            endpoint.path ||
                                            "/"
                                        }

                                    </span>


                                    <strong>

                                        {Number(
                                            value
                                        ).toFixed(2)}

                                        {metric === "latency"
                                            ? " ms"
                                            : metric === "error_rate"
                                                ? "%"
                                                : ""}

                                    </strong>

                                </div>
                            );
                        }
                    )}

                </div>
            )}

        </div>
    );
}


export default ApplicationMonitoring;
