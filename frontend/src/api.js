const configuredApiBaseUrl =
    import.meta.env.VITE_API_BASE_URL?.trim();

const isLocalDevelopmentHost = [
    "localhost",
    "127.0.0.1"
].includes(window.location.hostname);

const defaultApiBaseUrl = isLocalDevelopmentHost
    ? "http://127.0.0.1:8001"
    : window.location.origin;

export const API_BASE_URL = (
    configuredApiBaseUrl ||
    defaultApiBaseUrl
).replace(/\/+$/, "");


async function request(endpoint, options = {}) {

    const token = localStorage.getItem("access_token");

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    let response;

    try {

        response = await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                ...options,
                headers
            }
        );

    } catch (error) {

        console.error(
            "Backend connection failed:",
            error
        );

        throw new Error(
            "Unable to connect to APM backend. Make sure FastAPI is running on port 8001."
        );
    }

    const text = await response.text();

    let data = {};

    try {

        data = text
            ? JSON.parse(text)
            : {};

    } catch {

        data = {
            detail: text || "Invalid server response"
        };
    }


    if (response.status === 401) {

        localStorage.removeItem(
            "access_token"
        );

        window.location.href = "/login";

        throw new Error(
            data.detail ||
            "Session expired. Please login again."
        );
    }


    if (!response.ok) {

        throw new Error(
            data.detail ||
            data.message ||
            `Request failed with status ${response.status}`
        );
    }


    return data;
}


// ============================================================
// AUTH
// ============================================================

export async function registerUser(
    name,
    email,
    password
) {

    return request(
        "/auth/register",
        {
            method: "POST",
            body: JSON.stringify({
                name,
                email,
                password
            })
        }
    );
}


export async function loginUser(
    email,
    password
) {

    const data = await request(
        "/auth/login",
        {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        }
    );

    if (data.access_token) {

        localStorage.setItem(
            "access_token",
            data.access_token
        );
    }

    return data;
}


// ============================================================
// SYSTEM MONITORING
// ============================================================

export async function getSystemMetrics() {

    return request(
        "/system-metrics"
    );
}


// ============================================================
// AI
// ============================================================

export async function getAIAnalysis() {

    return request(
        "/ai-analysis"
    );
}


export async function getSelfHealing() {

    return request(
        "/self-healing"
    );
}


export async function executeSelfHealing(
    action
) {

    return request(
        "/self-healing/execute",
        {
            method: "POST",
            body: JSON.stringify({
                action
            })
        }
    );
}


// ============================================================
// INCIDENTS
// ============================================================

export async function getIncidents() {

    return request(
        "/incidents"
    );
}


export async function getOpenIncidents() {

    return request(
        "/incidents/open"
    );
}


// ============================================================
// TOKEN
// ============================================================

export function saveToken(token) {

    if (token) {

        localStorage.setItem(
            "access_token",
            token
        );
    }
}


export function getToken() {

    return localStorage.getItem(
        "access_token"
    );
}


export function removeToken() {

    localStorage.removeItem(
        "access_token"
    );
}


export function isAuthenticated() {

    return !!getToken();
}


export function logoutUser() {

    removeToken();

    window.location.href = "/login";
}


// ============================================================
// BACKEND CHECK
// ============================================================

export async function checkBackend() {

    try {

        const response = await fetch(
            `${API_BASE_URL}/system-metrics`
        );

        return response.ok;

    } catch {

        return false;
    }
}


// ============================================================
// APPLICATION MONITORING
// ============================================================

export async function getApplicationMonitoring() {

    return request(
        "/application-monitoring"
    );
}


export async function getApplicationEndpoints() {

    return request(
        "/application-monitoring/endpoints"
    );
}


// ============================================================
// SERVICE OBSERVABILITY
// ============================================================

export async function getObservabilityOverview() {

    return request(
        "/observability/overview"
    );
}


export async function getServices() {

    return request(
        "/observability/services"
    );
}


export async function getTopology() {

    return request(
        "/observability/topology"
    );
}


export async function getObservabilityAlerts() {

    return request(
        "/observability/alerts"
    );
}


export async function getTraces(limit = 12) {

    return request(
        `/observability/traces?limit=${limit}`
    );
}


export async function ingestServiceTelemetry(payload) {

    return request(
        "/observability/telemetry",
        {
            method: "POST",
            body: JSON.stringify(payload)
        }
    );
}


// ============================================================
// AGENT DEPLOYMENT
// ============================================================

export async function deployAgent(
    config
) {

    return request(
        "/agent/deploy",
        {
            method: "POST",
            body: JSON.stringify(config)
        }
    );
}


export async function getAgentDeploymentStatus() {

    return request(
        "/agent/deployment/status"
    );
}


// ============================================================
// AGENT STATUS
// ============================================================

export async function getAgentStatus() {

    return request(
        "/agent/status"
    );
}
