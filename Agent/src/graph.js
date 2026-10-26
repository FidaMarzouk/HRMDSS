// The ENOVA Assistant harness as a LangGraph state graph.
//
//   START → guard → route → compact → agent ⇄ tools
//                                       ↓
//                                      gate ──(interrupt: the person confirms or cancels in the app)──→ agent / END
//
// guard   Llama Prompt Guard on the new message; a flagged turn gets read tools only.
// route   small model picks the tool groups (skills) for the turn (progressive disclosure).
// compact summarises older turns once the conversation grows (context management).
// agent   main model with the selected tools bound; step budget per run.
// tools   calls the HRMS tool API as the person (delegated token); prepare tools return drafts.
// gate    pauses on open drafts; resumes with the person's decision from the app.
import { Annotation, END, MessagesAnnotation, START, StateGraph, interrupt } from '@langchain/langgraph';
import { AIMessage, HumanMessage, RemoveMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { config } from './config.js';
import * as backend from './backend.js';
import * as modelLayer from './models.js';
import { PAGE_SKILLS, SUMMARY_PROMPT, heuristicSkills, parseRouterReply, routerPrompt, systemPrompt } from './prompts.js';
import { extractSources } from './citations.js';

// Dependencies, replaceable in tests (fake models, fake tool API).
const deps = { invoke: modelLayer.invoke, guardScore: modelLayer.guardScore, callTool: backend.callTool };
const invoke = (...a) => deps.invoke(...a);
const guardScore = (...a) => deps.guardScore(...a);
const callTool = (...a) => deps.callTool(...a);

// Per-run data that must never be persisted in checkpoints (token, manifest, stats).
export const RUNS = new Map();
const runtime = (cfg) => {
  const rt = RUNS.get(cfg?.configurable?.run_id);
  if (!rt) throw new Error('Run context missing');
  return rt;
};

const keep = (a, b) => (b === undefined ? a : b);
export const State = Annotation.Root({
  ...MessagesAnnotation.spec,
  skills: Annotation({ reducer: keep, default: () => [] }),
  readOnly: Annotation({ reducer: keep, default: () => false }),
  // Drafts prepared in this conversation that still wait for the person.
  pending: Annotation({ reducer: keep, default: () => [] }),
  summary: Annotation({ reducer: keep, default: () => '' }),
  calls: Annotation({ reducer: keep, default: () => 0 }),
  // Handbook passages returned in this run, numbered for citations.
  passages: Annotation({ reducer: keep, default: () => [] }),
  next: Annotation({ reducer: keep, default: () => null }),
});

const text = (m) => (typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map((c) => c.text || '').join('') : '');
export const isAppNote = (m) => m instanceof HumanMessage && m.additional_kwargs?.app === true;
const appNote = (content) => new HumanMessage({ content: `[App] ${content}`, additional_kwargs: { app: true } });
const lastHuman = (messages) => [...messages].reverse().find((m) => m instanceof HumanMessage && !isAppNote(m));

// --- guard -----------------------------------------------------------------------
const guard = async (state, cfg) => {
  const rt = runtime(cfg);
  const message = lastHuman(state.messages);
  const score = message ? await guardScore(text(message)) : 0;
  const flagged = score >= config.guardThreshold;
  rt.stats.guard = { flagged, score: Math.round(score * 1000) / 1000 };
  return { readOnly: flagged, calls: 0, passages: [], next: null };
};

// --- route -----------------------------------------------------------------------
const route = async (state, cfg) => {
  const rt = runtime(cfg);
  const available = new Set(rt.manifest.tools.map((t) => t.skill));
  const latest = text(lastHuman(state.messages) || { content: '' });
  // A few recent lines so follow-ups ("yes, the second room") keep their group.
  const recent = state.messages
    .slice(-6)
    .filter((m) => (m instanceof HumanMessage && !isAppNote(m)) || (m instanceof AIMessage && text(m)))
    .map((m) => `${m instanceof HumanMessage ? 'Person' : 'Assistant'}: ${text(m).slice(0, 300)}`)
    .join('\n');
  let skills = null;
  try {
    const { message: reply } = await invoke('router', [new SystemMessage(routerPrompt(rt.user.role)), new HumanMessage(`${recent}\n\nLatest message: ${latest}`)]);
    rt.addUsage(reply);
    const parsed = parseRouterReply(reply.content);
    // Keywords in the latest message add groups the router missed (cheap recall; the router stays the main signal).
    if (parsed) skills = [...new Set([...(parsed.skills.length || parsed.smalltalk ? parsed.skills : PAGE_SKILLS[rt.context.page] || []), ...heuristicSkills(latest)])];
  } catch (error) {
    rt.stats.routerError = error.message;
  }
  if (!skills) skills = [...new Set([...heuristicSkills(`${recent}\n${latest}`), ...(PAGE_SKILLS[rt.context.page] || [])])];
  skills = ['core', ...skills.filter((s) => s !== 'core' && available.has(s))];
  rt.stats.skills = skills;
  return { skills };
};

// --- compact ---------------------------------------------------------------------
const size = (messages) => messages.reduce((n, m) => n + text(m).length + JSON.stringify(m.tool_calls || []).length, 0);

const compact = async (state, cfg) => {
  if (size(state.messages) < config.compactAfterChars) return {};
  const rt = runtime(cfg);
  let cut = state.messages.length - config.keepRecentMessages;
  // Never separate a tool call from its results.
  while (cut > 0 && state.messages[cut] instanceof ToolMessage) cut -= 1;
  if (cut <= 0) return {};
  const older = state.messages.slice(0, cut);
  const transcript = older
    .map((m) => {
      if (m instanceof ToolMessage) return `Tool ${m.name}: ${text(m).slice(0, 400)}`;
      if (m instanceof AIMessage) return `Assistant: ${text(m).slice(0, 600)}${m.tool_calls?.length ? ` [called ${m.tool_calls.map((c) => c.name).join(', ')}]` : ''}`;
      return `${isAppNote(m) ? 'App' : 'Person'}: ${text(m).slice(0, 600)}`;
    })
    .join('\n');
  try {
    const { message: reply } = await invoke('router', [new SystemMessage(SUMMARY_PROMPT),new HumanMessage(`${state.summary ? `Earlier summary:\n${state.summary}\n\n` : ''}${transcript}`)]);
    rt.addUsage(reply);
    rt.stats.compacted = older.length;
    return { summary: text(reply).slice(0, 3000), messages: older.map((m) => new RemoveMessage({ id: m.id })) };
  } catch {
    return {};
  }
};

// --- agent -----------------------------------------------------------------------
const toolDefs = (manifest, skills, readOnly) =>
  manifest.tools
    .filter((t) => skills.includes(t.skill) && (!readOnly || t.effect === 'read'))
    .map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.effect === 'prepare' ? `${t.description} (Creates a draft the person confirms.)` : t.description, parameters: t.parameters },
    }));

const isToolFailure = (error) => /tool_use_failed|failed to call a function|Failed to parse tool call/i.test(`${error?.message || ''} ${JSON.stringify(error?.error || '')}`);

const agent = async (state, cfg) => {
  const rt = runtime(cfg);
  const lastCall = state.calls >= config.maxModelCalls - 1;
  const defs = lastCall ? [] : toolDefs(rt.manifest, state.skills, state.readOnly);
  const system = new SystemMessage(
    systemPrompt({ user: rt.user, page: rt.context.page, selection: rt.context.selection, skills: state.skills, readOnly: state.readOnly, summary: state.summary }) +
      (lastCall ? '\n\nStep budget reached: answer now with what you have, without calling tools.' : '')
  );
  const history = [system, ...state.messages];
  const onFallback = (model, wait) => rt.stats.fallbacks.push({ model, wait: Math.round(wait) });
  let response;
  try {
    ({ message: response } = await invoke('main', history, { tools: defs, onFallback }));
  } catch (error) {
    if (!isToolFailure(error)) throw error;
    // A malformed tool call: retry once with a reminder, then without tools.
    rt.stats.toolCallRetries = (rt.stats.toolCallRetries || 0) + 1;
    try {
      ({ message: response } = await invoke('main', [...history, new SystemMessage('Your last tool call was malformed. Call one tool with valid JSON arguments matching its schema, or answer directly.')], { tools: defs, onFallback }));
    } catch (retryError) {
      if (!isToolFailure(retryError)) throw retryError;
      ({ message: response } = await invoke('main', history, { onFallback }));
    }
  }
  rt.addUsage(response);
  // Final answer: turn [n] markers into sources and store them with the message.
  if (!response.tool_calls?.length) {
    const { answer, sources } = extractSources(text(response), state.passages);
    response = new AIMessage({ id: response.id, content: answer || "Sorry, I couldn't come up with an answer. Could you rephrase?", additional_kwargs: { sources }, usage_metadata: response.usage_metadata });
  }
  return { messages: [response], calls: state.calls + 1 };
};

// --- tools -----------------------------------------------------------------------
const truncate = (s) => (s.length <= config.maxToolChars ? s : `${s.slice(0, config.maxToolChars - 800)} …[${s.length - config.maxToolChars + 800} characters cut; ask a narrower question]… ${s.slice(-600)}`);

const tools = async (state, cfg) => {
  const rt = runtime(cfg);
  const last = state.messages.at(-1);
  const pending = [...state.pending];
  const passages = [...state.passages];
  const out = [];
  for (const call of last.tool_calls || []) {
    const t0 = Date.now();
    let result;
    try {
      result = await callTool(rt.token, call.name, call.args || {});
    } catch (error) {
      result = { ok: false, error: error.status === 401 ? 'The session expired: the person should send their message again.' : 'The tool could not be reached.' };
    }
    rt.stats.toolCalls.push({ name: call.name, ms: Date.now() - t0, ok: Boolean(result.ok) });
    let payload = result.ok ? result.data : { error: result.error };
    if (call.name === 'search_handbook' && result.ok) {
      payload = {
        passages: (result.data.passages || []).map((p) => {
          const n = passages.length + 1;
          passages.push({ n, source: p.source });
          return { ...p, n };
        }),
      };
    }
    if (result.ok && result.data?.draft) {
      pending.push(result.data.draft);
      rt.stats.drafts.push({ kind: result.data.draft.kind });
    }
    out.push(new ToolMessage({ tool_call_id: call.id, name: call.name, content: truncate(JSON.stringify(payload)) }));
  }
  return { messages: out, pending, passages };
};

// --- gate ------------------------------------------------------------------------
const gate = async (state) => {
  const open = state.pending.filter((d) => d.status === 'pending');
  if (!open.length) return { next: 'end' };
  // Pauses the run here; the app resumes it with the person's decision.
  const answer = interrupt({ drafts: open });
  if (!answer || answer.superseded) {
    return { pending: [], next: 'end', messages: [appNote('The person moved on without deciding on the prepared draft(s); they stay in the panel until they expire.')] };
  }
  const draft = open.find((d) => d.id === answer.draftId);
  const rest = state.pending.filter((d) => d.id !== answer.draftId);
  if (!draft) return { pending: rest, next: rest.length ? 'gate' : 'end' };
  if (answer.status === 'cancelled') {
    return { pending: rest, next: rest.length ? 'gate' : 'end', messages: [appNote(`The person cancelled "${draft.title}".`), new AIMessage("Okay, I've left that one out.")] };
  }
  const note =
    answer.status === 'confirmed'
      ? `The person confirmed "${draft.title}" and the app carried it out. Result: ${JSON.stringify(answer.result || {})}. Tell them it is done in one or two sentences, with the useful detail (e.g. who reviews it next). Do not prepare it again.`
      : `The person confirmed "${draft.title}" but the app refused it: ${answer.error}. Explain in one sentence and offer an alternative.`;
  return { pending: rest, next: 'agent', calls: 0, messages: [appNote(note)] };
};

export const buildGraph = (checkpointer, overrides = {}) => {
  Object.assign(deps, overrides);
  return new StateGraph(State)
    .addNode('guard', guard)
    .addNode('route', route)
    .addNode('compact', compact)
    .addNode('agent', agent)
    .addNode('tools', tools)
    .addNode('gate', gate)
    .addEdge(START, 'guard')
    .addEdge('guard', 'route')
    .addEdge('route', 'compact')
    .addEdge('compact', 'agent')
    .addConditionalEdges('agent', (state) => (state.messages.at(-1)?.tool_calls?.length && state.calls < config.maxModelCalls ? 'tools' : 'gate'), ['tools', 'gate'])
    .addEdge('tools', 'agent')
    .addConditionalEdges('gate', (state) => (state.next === 'agent' ? 'agent' : state.next === 'gate' ? 'gate' : END), ['agent', 'gate', END])
    .compile({ checkpointer });
};

export const _test = { guard, route, compact, agent, tools, gate, toolDefs, truncate };
