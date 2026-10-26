// ENOVA Assistant API.
//  Panel (the person's own session): messages, conversation, draft confirm /
//  cancel, feedback; HR and the CEO: usage stats.
//  Agent service (shared secret + delegated token): tool manifest, tool calls,
//  run summaries. See services/assistant/*.
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../Models/User');
const AssistantThread = require('../Models/AssistantThread');
const AssistantDraft = require('../Models/AssistantDraft');
const AssistantRun = require('../Models/AssistantRun');
const registry = require('../services/assistant/registry');
const drafts = require('../services/assistant/drafts');
const delegation = require('../services/assistant/delegation');
const agent = require('../services/assistant/agentClient');
const ragAssistant = require('../services/rag/assistant');

const MAX_MESSAGE = 1000;

const me = (req) => ({ id: req.user.id, role: req.user.role, sid: req.user.sid });

const currentThread = async (userId, create = true) => {
  let thread = await AssistantThread.findOne({ userId, active: true }).sort({ updatedAt: -1 });
  if (!thread && create) thread = await AssistantThread.create({ userId, threadId: `t_${crypto.randomUUID()}` });
  return thread;
};

const draftsById = async (userId, ids) => {
  if (!ids?.length) return [];
  const rows = await AssistantDraft.find({ _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)) }, userId }).lean();
  const byId = new Map(rows.map((d) => [String(d._id), drafts.view(d)]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
};

// Without the agent service: answer from the handbook only (the previous assistant).
const offlineAnswer = async (req, text) => {
  const user = await User.findById(req.user.id).select('firstName role').lean();
  const { answer, sources } = await ragAssistant.answerQuestion({ user: { id: req.user.id, firstName: user.firstName, role: user.role }, message: text, history: [] });
  return { replies: [{ id: `offline_${Date.now()}`, text: `${answer}\n\n_The assistant can't prepare actions right now; this answer comes from the handbook only._`, sources }], drafts: [], offline: true };
};

// POST /api/assistant/messages { text, context: { page, selection } }
exports.sendMessage = async (req, res) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ message: 'Type a message.' });
    if (text.length > MAX_MESSAGE) return res.status(400).json({ message: `Messages are limited to ${MAX_MESSAGE} characters.` });
    const context = { page: String(req.body?.context?.page || '').slice(0, 40) || null, selection: String(req.body?.context?.selection || '').slice(0, 200) || null };
    const user = await User.findById(req.user.id).select('firstName role').lean();
    const thread = await currentThread(req.user.id);
    if (!thread.title) {
      thread.title = text.slice(0, 120);
      await thread.save();
    }
    if (!agent.isConfigured()) return res.json(await offlineAnswer(req, text));
    let out;
    try {
      out = await agent.run({ threadId: thread.threadId, token: delegation.mint(me(req), thread.threadId), user: { id: req.user.id, firstName: user.firstName, role: user.role }, text, context });
    } catch (error) {
      if (error.status === 409) return res.status(409).json({ message: error.message });
      // The AI service is rate limited: say when to try again rather than falling back.
      if (error.status === 503) return res.status(503).json({ message: error.message });
      console.error('Agent unavailable:', error.message);
      await AssistantRun.create({ userId: req.user.id, role: req.user.role, page: context.page, outcome: 'offline', error: error.message.slice(0, 200) }).catch(() => {});
      return res.json(await offlineAnswer(req, text));
    }
    thread.updatedAt = new Date();
    await thread.save();
    res.json({ replies: out.replies, drafts: await draftsById(req.user.id, out.draftIds), tools: out.tools, runId: out.runId, waitingForConfirmation: out.waitingForConfirmation });
  } catch (error) {
    console.error('Assistant message failed:', error);
    res.status(500).json({ message: 'The assistant could not answer right now.' });
  }
};

// GET /api/assistant/thread: the current conversation with its drafts.
exports.getThread = async (req, res) => {
  try {
    const thread = await currentThread(req.user.id, false);
    if (!thread) return res.json({ messages: [], drafts: {} });
    let view = { messages: [] };
    if (agent.isConfigured()) {
      try {
        view = await agent.thread(thread.threadId);
      } catch {
        view = { messages: [], offline: true };
      }
    }
    const ids = view.messages.flatMap((m) => m.draftIds || []);
    const list = await draftsById(req.user.id, ids);
    res.json({ messages: view.messages, drafts: Object.fromEntries(list.map((d) => [d.id, d])), offline: Boolean(view.offline) });
  } catch (error) {
    console.error('Assistant thread failed:', error);
    res.status(500).json({ message: 'Could not load the conversation' });
  }
};

// POST /api/assistant/thread/new: start a fresh conversation (the old one is forgotten).
exports.newThread = async (req, res) => {
  try {
    const old = await AssistantThread.find({ userId: req.user.id, active: true });
    await AssistantThread.updateMany({ userId: req.user.id, active: true }, { $set: { active: false } });
    await AssistantDraft.updateMany({ userId: req.user.id, status: 'pending' }, { $set: { status: 'expired' } });
    if (agent.isConfigured()) await Promise.all(old.map((t) => agent.deleteThread(t.threadId).catch(() => {})));
    res.json({ ok: true });
  } catch (error) {
    console.error('New assistant thread failed:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Resume the agent after a decision, so it can confirm or explain (best effort).
const tellAgent = async (req, draft) => {
  if (!agent.isConfigured()) return { replies: [] };
  const user = await User.findById(req.user.id).select('firstName role').lean();
  try {
    return await agent.resume({
      threadId: draft.threadId,
      token: delegation.mint(me(req), draft.threadId),
      user: { id: req.user.id, firstName: user.firstName, role: user.role },
      context: { page: String(req.body?.context?.page || '') || null },
      decision: { draftId: String(draft._id), title: draft.title, status: draft.status, result: draft.result || null, error: draft.error || null },
    });
  } catch (error) {
    console.error('Agent resume failed:', error.message);
    return { replies: [] };
  }
};

const decide = (fn) => async (req, res) => {
  try {
    const out = await fn(me(req), req.params.id);
    if (out.error) return res.status(out.status).json({ message: out.error });
    const draft = await AssistantDraft.findById(out.draft.id).lean();
    const follow = await tellAgent(req, draft);
    res.status(out.status === 200 ? 200 : out.status).json({ draft: out.draft, replies: follow.replies || [], drafts: await draftsById(req.user.id, follow.draftIds || []), runId: follow.runId || null });
  } catch (error) {
    console.error('Assistant draft decision failed:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/assistant/drafts/:id/confirm and /cancel: always the person's own session.
exports.confirmDraft = decide(drafts.confirm);
exports.cancelDraft = decide(drafts.cancel);

// PUT /api/assistant/runs/:id/feedback { value: "up" | "down" | null }
exports.feedback = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !['up', 'down', null].includes(req.body?.value ?? null)) return res.status(400).json({ message: 'Invalid feedback' });
    const run = await AssistantRun.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: { feedback: req.body.value ?? null } }, { new: true });
    if (!run) return res.status(404).json({ message: 'Run not found' });
    res.json({ feedback: run.feedback });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/assistant/status: whether actions are available, and the models.
exports.status = async (req, res) => {
  const health = agent.isConfigured() ? await agent.health() : null;
  res.json({ online: Boolean(health?.ok), models: health?.models || null });
};

// GET /api/assistant/stats?days=30 (HR, CEO): metadata only, no conversation text.
exports.stats = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const runs = await AssistantRun.find({ createdAt: { $gte: since } }).lean();
    const by = (key) => runs.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + 1), acc), {});
    const latencies = runs.map((r) => r.latencyMs).filter(Number.isFinite).sort((a, b) => a - b);
    const pct = (p) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] : null);
    const tools = {};
    runs.forEach((r) =>
      (r.toolCalls || []).forEach((t) => {
        const s = (tools[t.name] = tools[t.name] || { calls: 0, failed: 0, ms: 0 });
        s.calls++;
        if (!t.ok) s.failed++;
        s.ms += t.ms || 0;
      })
    );
    const confirmedDrafts = await AssistantDraft.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { kind: '$kind', status: '$status' }, n: { $sum: 1 } } }]);
    res.json({
      days,
      runs: runs.length,
      people: new Set(runs.map((r) => String(r.userId))).size,
      outcomes: by('outcome'),
      byRole: by('role'),
      latency: { p50: pct(0.5), p95: pct(0.95) },
      tokens: runs.reduce((acc, r) => ({ input: acc.input + (r.tokens?.input || 0), output: acc.output + (r.tokens?.output || 0) }), { input: 0, output: 0 }),
      feedback: { up: runs.filter((r) => r.feedback === 'up').length, down: runs.filter((r) => r.feedback === 'down').length },
      flagged: runs.filter((r) => r.guard?.flagged).length,
      tools: Object.entries(tools).map(([name, s]) => ({ name, calls: s.calls, failed: s.failed, avgMs: Math.round(s.ms / s.calls) })).sort((a, b) => b.calls - a.calls),
      drafts: confirmedDrafts.map((d) => ({ kind: d._id.kind, status: d._id.status, count: d.n })),
    });
  } catch (error) {
    console.error('Assistant stats failed:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Agent-facing ----------------------------------------------------------------

// GET /api/assistant/tools: the tools this person's role may use.
exports.manifest = (req, res) => res.json({ tools: registry.manifestFor(req.delegated.role), skills: registry.SKILLS });

// POST /api/assistant/tools/:name { args }
exports.runTool = async (req, res) => {
  const out = await registry.execute({ user: { id: req.delegated.id, role: req.delegated.role, sid: req.delegated.sid }, threadId: req.delegated.thread }, req.params.name, req.body?.args);
  res.json(out);
};

// POST /api/assistant/runs: metadata-only run summary from the agent.
exports.recordRun = async (req, res) => {
  try {
    const b = req.body || {};
    const run = await AssistantRun.create({
      userId: req.delegated.id,
      role: req.delegated.role,
      kind: b.kind === 'resume' ? 'resume' : 'message',
      page: b.page || null,
      skills: (b.skills || []).slice(0, 10),
      models: b.models,
      toolCalls: (b.toolCalls || []).slice(0, 30).map((t) => ({ name: String(t.name).slice(0, 60), ms: Number(t.ms) || 0, ok: Boolean(t.ok) })),
      drafts: (b.drafts || []).slice(0, 10).map((d) => ({ kind: String(d.kind).slice(0, 40) })),
      steps: Number(b.steps) || 0,
      fallbacks: Number(b.fallbacks) || 0,
      tokens: { input: Number(b.tokens?.input) || 0, output: Number(b.tokens?.output) || 0 },
      latencyMs: Number(b.latencyMs) || 0,
      outcome: ['answered', 'drafted', 'blocked', 'error'].includes(b.outcome) ? b.outcome : 'answered',
      guard: b.guard ? { flagged: Boolean(b.guard.flagged), score: Number(b.guard.score) || 0 } : undefined,
      error: b.error ? String(b.error).slice(0, 300) : undefined,
    });
    res.status(201).json({ id: String(run._id) });
  } catch (error) {
    console.error('Run summary failed:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
