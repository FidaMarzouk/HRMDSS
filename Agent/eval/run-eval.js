// Runs the evaluation tasks against the sandbox and writes a report.
//   docker compose -f docker-compose.sandbox.yml --env-file Agent/.env run --rm eval
// Env: BACKEND_URL, SANDBOX_MONGO_URI, EVAL_LABEL (report name), EVAL_ONLY
// (comma-separated task ids), EVAL_PAUSE_MS (pause between tasks, for rate limits).
import fs from 'node:fs/promises';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { tasks } from './tasks.js';

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:18081').replace(/\/$/, '');
const MONGO = process.env.SANDBOX_MONGO_URI;
const LABEL = process.env.EVAL_LABEL || 'default';
const PAUSE = Number(process.env.EVAL_PAUSE_MS || 15000);
const ONLY = (process.env.EVAL_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const PASSWORD = process.env.EVAL_PASSWORD || 'Enova@2026';
const EMAILS = { employee: 'employee@enova.test', manager: 'manager@enova.test', hr: 'hr@enova.test', ceo: 'ceo@enova.test' };

if (!MONGO || !/sandbox/i.test(MONGO)) {
  console.error('Refusing to run: SANDBOX_MONGO_URI must point at the sandbox database.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TZ = 'Africa/Tunis';
const keyOf = (d) => d.toLocaleDateString('en-CA', { timeZone: TZ });
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const isWeekend = (d) => [0, 6].includes(new Date(`${keyOf(d)}T12:00:00Z`).getUTCDay());
const workday = (from, n) => {
  let d = from;
  let left = n;
  const step = n >= 0 ? 1 : -1;
  while (left !== 0 || isWeekend(d)) {
    d = addDays(d, step);
    if (!isWeekend(d)) left -= step;
    if (left === 0 && !isWeekend(d)) break;
  }
  return keyOf(d);
};

const api = async (cookie, method, url, body) => {
  const t0 = Date.now();
  const res = await fetch(BACKEND + url, { method, headers: { cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, ms: Date.now() - t0, body: await res.json().catch(() => null) };
};
const login = async (role) => {
  const res = await fetch(`${BACKEND}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAILS[role], password: PASSWORD }) });
  if (res.status !== 200) throw new Error(`login ${role}: ${res.status}`);
  return (res.headers.get('set-cookie') || '').split(';')[0];
};

const env = async (db) => {
  const now = new Date();
  const users = {};
  for (const [role, email] of Object.entries(EMAILS)) users[role] = await db.collection('users').findOne({ email });
  const today = keyOf(now);
  const named = (u) => u && { _id: u._id, name: `${u.firstName} ${u.lastName}` };
  const colleague = await db.collection('users').findOne({ managerId: users.employee.managerId, role: 'employee', _id: { $ne: users.employee._id }, status: { $ne: 'archived' } });
  return {
    users,
    colleague: named(colleague),
    manager: named(users.manager),
    today,
    nextWorkday: workday(now, 1),
    nextWorkday2: workday(now, 2),
    nextWorkday3: workday(now, 3),
    lastWorkday: workday(now, -1),
    leaveStart: workday(now, 18),
    leaveEnd: workday(now, 19),
    cancelDay: workday(now, 22),
    day: (key) => new Date(`${typeof key === 'string' ? key : keyOf(key)}T00:00:00+01:00`),
    at: (key, hhmm) => new Date(`${key}T${hhmm}:00+01:00`),
    label: (key) => new Date(`${typeof key === 'string' ? key : keyOf(key)}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
};

const check = async (task, turns, db, e, vars, runs) => {
  const fails = [];
  const x = task.expect || {};
  const allDrafts = turns.flatMap((t) => t.drafts);
  const kinds = allDrafts.map((d) => d.kind);
  const tools = [...new Set(turns.flatMap((t) => t.tools))];
  const text = turns.map((t) => t.replies.join('\n')).join('\n');
  if (x.draftKinds && JSON.stringify([...new Set(kinds)]) !== JSON.stringify(x.draftKinds)) fails.push(`drafts ${JSON.stringify(kinds)} ≠ ${JSON.stringify(x.draftKinds)}`);
  if (x.draftKindsByTurn) x.draftKindsByTurn.forEach((k, i) => {
    const got = (turns[i]?.drafts || []).map((d) => d.kind);
    if (JSON.stringify(got) !== JSON.stringify(k)) fails.push(`turn ${i + 1} drafts ${JSON.stringify(got)} ≠ ${JSON.stringify(k)}`);
  });
  if (x.toolsAny && !x.toolsAny.some((t) => tools.includes(t))) fails.push(`none of ${x.toolsAny.join('/')} used (used: ${tools.join(', ') || 'none'})`);
  if (x.toolsNone) x.toolsNone.filter((t) => tools.includes(t)).forEach((t) => fails.push(`used forbidden tool ${t}`));
  if (x.replyMatches && !x.replyMatches.test(text)) fails.push(`reply does not match ${x.replyMatches}`);
  if (x.replyNotMatches && x.replyNotMatches.test(text)) fails.push(`reply matches forbidden ${x.replyNotMatches}`);
  if (x.sources && !turns.some((t) => t.sources > 0)) fails.push('no handbook source cited');
  if (x.outcome && !runs.some((r) => r.outcome === x.outcome)) fails.push(`no run with outcome ${x.outcome} (${runs.map((r) => r.outcome).join(', ')})`);
  if (x.reply) {
    const r = await x.reply(text, db, e, vars);
    if (r !== true) fails.push(r);
  }
  if (x.db) {
    const r = await x.db(db, e, vars);
    if (r !== true) fails.push(`db: ${r}`);
  }
  if (turns.some((t) => t.error)) fails.push(`error: ${turns.find((t) => t.error).error}`);
  return fails;
};

const main = async () => {
  const client = new MongoClient(MONGO);
  await client.connect();
  const db = client.db();
  const e = await env(db);
  const selected = ONLY.length ? tasks.filter((t) => ONLY.includes(t.id)) : tasks;
  const results = [];
  const status = await (await fetch(`${BACKEND}/api/assistant/status`, { headers: { cookie: await login('employee') } })).json().catch(() => ({}));
  console.log(`Eval "${LABEL}" · ${selected.length} tasks · models ${JSON.stringify(status.models)}`);

  for (const task of selected) {
    const started = new Date();
    const cookie = await login(task.user);
    await api(cookie, 'POST', '/api/assistant/thread/new');
    const vars = task.setup ? await task.setup(db, e) : {};
    if (vars?.skip) {
      results.push({ id: task.id, title: task.title, skipped: vars.skip });
      console.log(`SKIP ${task.id}: ${vars.skip}`);
      continue;
    }
    const turns = [];
    for (const turn of task.turns) {
      const { text, context } = typeof turn === 'function' ? turn({ env: e, vars }) : turn;
      const r = await api(cookie, 'POST', '/api/assistant/messages', { text, context: context || { page: 'today' } });
      const t = { text, ms: r.ms, status: r.status, replies: (r.body?.replies || []).map((m) => m.text), sources: (r.body?.replies || []).reduce((n, m) => n + (m.sources?.length || 0), 0), drafts: r.body?.drafts || [], tools: r.body?.tools || [], error: r.status >= 400 ? r.body?.message : null };
      for (const d of t.drafts) {
        if (task.confirm === 'all' || task.confirm === 'cancel') {
          const c = await api(cookie, 'POST', `/api/assistant/drafts/${d.id}/${task.confirm === 'cancel' ? 'cancel' : 'confirm'}`, { context: context || {} });
          t.decision = { status: c.body?.draft?.status, error: c.body?.draft?.error || (c.status >= 400 ? c.body?.message : null), ms: c.ms };
          t.replies.push(...(c.body?.replies || []).map((m) => m.text));
        }
      }
      turns.push(t);
    }
    const runs = await db.collection('assistantruns').find({ userId: e.users[task.user]._id, createdAt: { $gte: started } }).toArray();
    const fails = await check(task, turns, db, e, vars, runs);
    const result = {
      id: task.id,
      title: task.title,
      user: task.user,
      pass: fails.length === 0,
      fails,
      latencyMs: turns.reduce((n, t) => n + t.ms, 0),
      toolCalls: runs.reduce((n, r) => n + (r.toolCalls?.length || 0), 0),
      toolErrors: runs.reduce((n, r) => n + (r.toolCalls || []).filter((c) => !c.ok).length, 0),
      steps: runs.reduce((n, r) => n + (r.steps || 0), 0),
      tokens: runs.reduce((n, r) => n + (r.tokens?.input || 0) + (r.tokens?.output || 0), 0),
      fallbacks: runs.reduce((n, r) => n + (r.fallbacks || 0), 0),
      turns: turns.map((t) => ({ text: t.text, ms: t.ms, tools: t.tools, drafts: t.drafts.map((d) => `${d.kind}: ${d.title}`), decision: t.decision, reply: t.replies.join(' / ').slice(0, 600), error: t.error })),
    };
    results.push(result);
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${task.id} (${(result.latencyMs / 1000).toFixed(1)} s, ${result.toolCalls} tools, ${result.tokens} tokens${result.fallbacks ? `, ${result.fallbacks} fallbacks` : ''})${fails.length ? `\n     ${fails.join('\n     ')}` : ''}`);
    await sleep(PAUSE);
  }

  const ran = results.filter((r) => !r.skipped);
  const passed = ran.filter((r) => r.pass).length;
  const lat = ran.map((r) => r.latencyMs).sort((a, b) => a - b);
  const summary = {
    label: LABEL,
    at: new Date().toISOString(),
    models: status.models,
    passed,
    total: ran.length,
    skipped: results.length - ran.length,
    medianLatencyMs: lat[Math.floor(lat.length / 2)] || 0,
    p90LatencyMs: lat[Math.floor(lat.length * 0.9)] || 0,
    tokens: ran.reduce((n, r) => n + r.tokens, 0),
    toolErrors: ran.reduce((n, r) => n + r.toolErrors, 0),
    fallbacks: ran.reduce((n, r) => n + r.fallbacks, 0),
  };
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'reports');
  await fs.mkdir(dir, { recursive: true });
  const stamp = summary.at.slice(0, 16).replace(/[:T]/g, '-');
  await fs.writeFile(path.join(dir, `${stamp}-${LABEL}.json`), JSON.stringify({ summary, results }, null, 2));
  const md = [
    `# Assistant evaluation · ${LABEL}`,
    '',
    `${summary.at} · models: ${JSON.stringify(summary.models)}`,
    '',
    `**${passed}/${ran.length} passed**${summary.skipped ? ` (${summary.skipped} skipped)` : ''} · median ${(summary.medianLatencyMs / 1000).toFixed(1)} s · p90 ${(summary.p90LatencyMs / 1000).toFixed(1)} s · ${summary.tokens} tokens · ${summary.toolErrors} tool errors · ${summary.fallbacks} model fallbacks`,
    '',
    '| Task | Result | Time | Tools | Tokens | Notes |',
    '|---|---|---|---|---|---|',
    ...results.map((r) => (r.skipped ? `| ${r.title} | skipped | | | | ${r.skipped} |` : `| ${r.title} | ${r.pass ? 'pass' : '**fail**'} | ${(r.latencyMs / 1000).toFixed(1)} s | ${r.toolCalls} | ${r.tokens} | ${r.fails.join('; ').replace(/\|/g, '/')} |`)),
  ].join('\n');
  await fs.writeFile(path.join(dir, `${stamp}-${LABEL}.md`), md);
  console.log(`\n${passed}/${ran.length} passed · report eval/reports/${stamp}-${LABEL}.md`);
  await client.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
