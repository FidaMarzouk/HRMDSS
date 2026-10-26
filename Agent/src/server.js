// ENOVA Assistant agent service. Only the HRMS backend talks to it (shared
// secret); it reaches HR data exclusively through the backend's tool API with
// the person's delegated token, and keeps its own conversation state
// (LangGraph checkpoints) in its own database.
import crypto from 'node:crypto';
import express from 'express';
import { MongoClient } from 'mongodb';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { Command } from '@langchain/langgraph';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { assertConfigured, config } from './config.js';
import { RUNS, buildGraph, isAppNote } from './graph.js';
import { RateLimited } from './models.js';
import { getManifest, postRun } from './backend.js';

assertConfigured();

const client = new MongoClient(config.mongoUri);
await client.connect();
const checkpointer = new MongoDBSaver({ client, dbName: config.mongoDb });
const graph = buildGraph(checkpointer);

const app = express();
app.use(express.json({ limit: '200kb' }));

// Only the backend may call the agent.
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const given = req.get('x-agent-secret') || '';
  const ok = given.length === config.sharedSecret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(config.sharedSecret));
  if (!ok) return res.status(401).json({ message: 'Unauthorized' });
  next();
});

const text = (m) => (typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map((c) => c.text || '').join('') : '');

// One run at a time per conversation.
const locks = new Set();
const withLock = async (threadId, res, fn) => {
  if (locks.has(threadId)) return res.status(409).json({ message: 'The assistant is still answering your previous message.' });
  locks.add(threadId);
  try {
    return await fn();
  } finally {
    locks.delete(threadId);
  }
};

const newRun = ({ token, user, context = {} }, manifest, kind) => {
  const id = crypto.randomUUID();
  const rt = {
    id,
    token,
    user,
    context,
    manifest,
    started: Date.now(),
    stats: { kind, toolCalls: [], drafts: [], skills: [], fallbacks: [], tokens: { input: 0, output: 0 } },
    addUsage(msg) {
      const u = msg?.usage_metadata;
      if (u) {
        rt.stats.tokens.input += u.input_tokens || 0;
        rt.stats.tokens.output += u.output_tokens || 0;
      }
    },
  };
  RUNS.set(id, rt);
  return rt;
};

const runConfig = (threadId, rt) => ({
  configurable: { thread_id: threadId, run_id: rt.id },
  recursionLimit: 40,
  runName: 'enova-assistant',
  tags: [rt.user.role, rt.stats.kind],
  metadata: { role: rt.user.role, page: rt.context.page || null, kind: rt.stats.kind },
});

// Messages added by this run, shaped for the panel.
const shapeNew = (before, after) => {
  const added = after.slice(before);
  const draftIds = [];
  const replies = [];
  added.forEach((m) => {
    if (m instanceof ToolMessage) {
      try {
        const d = JSON.parse(text(m))?.draft;
        if (d?.id) draftIds.push(d.id);
      } catch {
        // truncated or plain text
      }
    }
    if (m instanceof AIMessage && text(m) && !m.tool_calls?.length) replies.push({ id: m.id, text: text(m), sources: m.additional_kwargs?.sources || [] });
  });
  return { replies, draftIds, tools: [...new Set(added.filter((m) => m instanceof AIMessage).flatMap((m) => (m.tool_calls || []).map((c) => c.name)))] };
};

const finish = async (threadId, rt, before, outcomeError) => {
  const state = await graph.getState({ configurable: { thread_id: threadId } });
  const messages = state.values.messages || [];
  const shaped = shapeNew(before, messages);
  const waiting = (state.tasks || []).some((t) => t.interrupts?.length);
  const outcome = outcomeError ? 'error' : rt.stats.guard?.flagged ? 'blocked' : shaped.draftIds.length ? 'drafted' : 'answered';
  const summary = {
    kind: rt.stats.kind,
    page: rt.context.page || null,
    skills: rt.stats.skills,
    models: { router: config.models.router, main: config.models.main.join(' > ') },
    toolCalls: rt.stats.toolCalls,
    drafts: rt.stats.drafts,
    steps: state.values.calls || 0,
    fallbacks: rt.stats.fallbacks.length,
    tokens: rt.stats.tokens,
    latencyMs: Date.now() - rt.started,
    outcome,
    guard: rt.stats.guard,
    error: outcomeError ? String(outcomeError.message || outcomeError).slice(0, 300) : undefined,
  };
  const stored = await postRun(rt.token, summary);
  RUNS.delete(rt.id);
  return { ...shaped, waitingForConfirmation: waiting, runId: stored?.id || null, outcome, stats: { latencyMs: summary.latencyMs, steps: summary.steps, skills: summary.skills, tokens: summary.tokens } };
};

const isWaiting = async (threadId) => {
  const state = await graph.getState({ configurable: { thread_id: threadId } });
  return { state, waiting: (state.tasks || []).some((t) => t.interrupts?.length) };
};

// POST /runs { threadId, token, user: { id, firstName, role }, text, context: { page, selection } }
app.post('/runs', async (req, res) => {
  const { threadId, token, user, text: message, context } = req.body || {};
  if (!threadId || !token || !user?.role || !message) return res.status(400).json({ message: 'threadId, token, user and text are required' });
  return withLock(threadId, res, async () => {
    let rt;
    let before = 0;
    try {
      const manifest = await getManifest(token);
      // A new message while drafts wait: close that pause first (the drafts stay confirmable).
      const { state, waiting } = await isWaiting(threadId);
      if (waiting) {
        const quiet = newRun({ token, user, context }, manifest, 'resume');
        await graph.invoke(new Command({ resume: { superseded: true } }), runConfig(threadId, quiet));
        RUNS.delete(quiet.id);
      }
      rt = newRun({ token, user, context }, manifest, 'message');
      before = (waiting ? (await graph.getState({ configurable: { thread_id: threadId } })).values.messages : state.values.messages || []).length;
      await graph.invoke({ messages: [new HumanMessage(String(message).slice(0, 2000))] }, runConfig(threadId, rt));
      res.json(await finish(threadId, rt, before));
    } catch (error) {
      console.error('Run failed:', error.message);
      if (rt) await finish(threadId, rt, before, error).catch(() => {});
      if (error instanceof RateLimited || error.name === 'RateLimited') return res.status(503).json({ message: error.message, retryAfter: Math.ceil(error.waitSeconds || 30) });
      res.status(500).json({ message: 'The assistant could not answer right now.' });
    }
  });
});

// POST /runs/resume { threadId, token, user, context, decision: { draftId, status, result, error } }
app.post('/runs/resume', async (req, res) => {
  const { threadId, token, user, context, decision } = req.body || {};
  if (!threadId || !token || !decision?.draftId) return res.status(400).json({ message: 'threadId, token and decision are required' });
  return withLock(threadId, res, async () => {
    let rt;
    let before = 0;
    try {
      const { state, waiting } = await isWaiting(threadId);
      const waitingOn = waiting && state.tasks.flatMap((t) => t.interrupts).some((i) => (i.value?.drafts || []).some((d) => d.id === decision.draftId));
      if (!waitingOn) {
        // The conversation moved on: just let the agent know for the next turn.
        await graph.updateState({ configurable: { thread_id: threadId } }, { messages: [new HumanMessage({ content: `[App] The person ${decision.status} a draft prepared earlier ("${decision.title || decision.draftId}")${decision.error ? `: ${decision.error}` : ''}.`, additional_kwargs: { app: true } })] });
        return res.json({ replies: [], draftIds: [], tools: [], waitingForConfirmation: false, runId: null, outcome: 'noted' });
      }
      const manifest = await getManifest(token);
      rt = newRun({ token, user, context }, manifest, 'resume');
      before = state.values.messages.length;
      await graph.invoke(new Command({ resume: decision }), runConfig(threadId, rt));
      res.json(await finish(threadId, rt, before));
    } catch (error) {
      console.error('Resume failed:', error.message);
      if (rt) await finish(threadId, rt, before, error).catch(() => {});
      if (error instanceof RateLimited || error.name === 'RateLimited') return res.status(503).json({ message: error.message, retryAfter: Math.ceil(error.waitSeconds || 30) });
      res.status(500).json({ message: 'The assistant could not continue right now.' });
    }
  });
});

// GET /threads/:id: the conversation for the panel (person and assistant texts, drafts attached to replies).
app.get('/threads/:id', async (req, res) => {
  try {
    const state = await graph.getState({ configurable: { thread_id: req.params.id } });
    const messages = state.values?.messages || [];
    const items = [];
    let drafts = [];
    messages.forEach((m) => {
      if (m instanceof ToolMessage) {
        try {
          const d = JSON.parse(text(m))?.draft;
          if (d?.id) drafts.push(d.id);
        } catch {
          // ignore
        }
      } else if (m instanceof HumanMessage && !isAppNote(m)) {
        items.push({ id: m.id, role: 'user', text: text(m) });
      } else if (m instanceof AIMessage && text(m) && !m.tool_calls?.length) {
        items.push({ id: m.id, role: 'assistant', text: text(m), sources: m.additional_kwargs?.sources || [], draftIds: drafts });
        drafts = [];
      }
    });
    res.json({ messages: items, summary: state.values?.summary || '', waitingForConfirmation: (state.tasks || []).some((t) => t.interrupts?.length) });
  } catch (error) {
    console.error('Thread read failed:', error);
    res.status(500).json({ message: 'Could not read the conversation' });
  }
});

// DELETE /threads/:id: forget a conversation (its checkpoints).
app.delete('/threads/:id', async (req, res) => {
  try {
    await checkpointer.deleteThread(req.params.id);
    res.json({ deleted: true });
  } catch (error) {
    console.error('Thread delete failed:', error);
    res.status(500).json({ message: 'Could not delete the conversation' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, models: config.models, tracing: process.env.LANGSMITH_TRACING === 'true' }));

app.listen(config.port, () => console.log(`ENOVA agent listening on ${config.port} (main ${config.models.main}, router ${config.models.router})`));
