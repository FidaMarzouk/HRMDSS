// Calls from the backend to the agent service (shared secret). The agent only
// ever receives a short-lived delegated token for the person, never their cookie.
const AGENT_TIMEOUT_MS = 90_000;

const agentUrl = () => (process.env.AGENT_URL || 'http://localhost:8090').replace(/\/$/, '');
const isConfigured = () => Boolean(process.env.AGENT_SHARED_SECRET);

const call = async (method, path, body, timeout = AGENT_TIMEOUT_MS) => {
  const res = await fetch(`${agentUrl()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Agent-Secret': process.env.AGENT_SHARED_SECRET || '' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `Agent ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
};

const health = async () => {
  try {
    return await call('GET', '/health', undefined, 3000);
  } catch {
    return null;
  }
};

module.exports = {
  isConfigured,
  health,
  run: (body) => call('POST', '/runs', body),
  resume: (body) => call('POST', '/runs/resume', body),
  thread: (id) => call('GET', `/threads/${encodeURIComponent(id)}`, undefined, 10_000),
  deleteThread: (id) => call('DELETE', `/threads/${encodeURIComponent(id)}`, undefined, 10_000),
};
