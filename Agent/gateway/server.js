// Gateway for the agent's isolated Docker network. The agent container has no
// route to the internet or to the HR database: everything goes through here.
//
//  ingress  :8090  host/backend → agent (only the agent API paths)
//  egress   :8443  agent → allow-listed upstreams, by path prefix:
//                    /groq/       → https://api.groq.com          (models)
//                    /backend/    → the HRMS backend               (only /api/assistant/*)
//                    /langsmith/  → https://api.smith.langchain.com (tracing, optional)
// Anything else is refused. Each request is logged as one JSON line (no bodies).
import http from 'node:http';

const AGENT_TARGET = process.env.AGENT_TARGET || 'http://agent:8090';
const EGRESS = [
  { prefix: '/groq/', target: 'https://api.groq.com' },
  { prefix: '/backend/', target: process.env.BACKEND_TARGET || 'http://host.docker.internal:8081', only: /^\/api\/assistant\// },
  { prefix: '/langsmith/', target: process.env.LANGSMITH_TARGET || 'https://api.smith.langchain.com' },
];
const INGRESS_PATHS = /^\/(runs|runs\/resume|threads\/[^/]+|health)$/;
const HOP = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'te', 'trailer', 'content-length']);

const log = (entry) => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) reject(new Error('Body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const forward = async (req, res, url, direction) => {
  const t0 = Date.now();
  try {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !HOP.has(k.toLowerCase())));
    const upstream = await fetch(url, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(120_000) });
    const out = {};
    upstream.headers.forEach((v, k) => {
      if (!HOP.has(k.toLowerCase()) && k.toLowerCase() !== 'content-encoding') out[k] = v;
    });
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, out);
    res.end(buffer);
    log({ direction, method: req.method, to: new URL(url).host, path: new URL(url).pathname, status: upstream.status, ms: Date.now() - t0, bytes: buffer.length });
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Upstream unavailable' }));
    log({ direction, method: req.method, to: url, status: 502, ms: Date.now() - t0, error: error.message });
  }
};

// Egress: only allow-listed upstreams.
http
  .createServer((req, res) => {
    const route = EGRESS.find((r) => req.url.startsWith(r.prefix));
    const rest = route ? req.url.slice(route.prefix.length - 1) : null;
    if (!route || (route.only && !route.only.test(rest))) {
      log({ direction: 'egress', method: req.method, path: req.url, status: 403, refused: true });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Destination not allowed' }));
    }
    forward(req, res, `${route.target}${rest}`, 'egress');
  })
  .listen(8443, () => log({ event: 'egress listening', port: 8443 }));

// Ingress: only the agent API.
http
  .createServer((req, res) => {
    const path = req.url.split('?')[0];
    if (!INGRESS_PATHS.test(path)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Not found' }));
    }
    forward(req, res, `${AGENT_TARGET}${req.url}`, 'ingress');
  })
  .listen(8090, () => log({ event: 'ingress listening', port: 8090 }));
