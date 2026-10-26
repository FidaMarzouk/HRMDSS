// Client for the HRMS assistant tool API. Every call carries the shared
// secret (this is the agent service) and the person's short-lived delegated
// token (it acts as them, with their permissions, and can only prepare drafts).
import { config } from './config.js';

const TIMEOUT_MS = 20_000;

const request = async (token, method, path, body) => {
  const res = await fetch(`${config.backendUrl}/api/assistant${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': config.sharedSecret,
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `Backend ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
};

// Tool definitions allowed for the person (by role), grouped by skill.
export const getManifest = (token) => request(token, 'GET', '/tools');

// { ok, data, effect } or { ok: false, error }
export const callTool = (token, name, args) => request(token, 'POST', `/tools/${encodeURIComponent(name)}`, { args });

// Metadata-only run summary for observability.
export const postRun = (token, summary) => request(token, 'POST', '/runs', summary).catch((e) => console.error('Run summary not stored:', e.message));
