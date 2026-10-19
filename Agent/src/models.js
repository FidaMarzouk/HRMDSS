// Model routing, rate-limit handling and the input guard.
//  - router: small and fast, low reasoning effort; picks the tool groups (skills).
//  - main:   a chain of models; the first plans and calls tools, the next ones
//            take over when the previous is rate limited (each has its own quota).
//  - guard:  Llama Prompt Guard; probability that a message is a prompt injection.
import { ChatGroq } from '@langchain/groq';
import { config } from './config.js';

const instances = new Map();
const chat = (model, opts) => {
  const key = `${model}|${JSON.stringify(opts)}`;
  if (!instances.has(key)) instances.set(key, new ChatGroq({ apiKey: config.groqApiKey, baseUrl: config.groqBaseUrl, model, maxRetries: 0, ...opts }));
  return instances.get(key);
};

const ROUTER_OPTS = { temperature: 0, maxTokens: 400, reasoningEffort: 'low' };
const MAIN_OPTS = { temperature: 0.2, maxTokens: 1400 };
// Reasoning effort only exists on the gpt-oss models.
const optsFor = (model, base) => (model.startsWith('openai/gpt-oss') ? { ...base, reasoningEffort: base.reasoningEffort || 'medium' } : (({ reasoningEffort, ...rest }) => rest)(base));

export class RateLimited extends Error {
  constructor(waitSeconds) {
    super(`The AI service is busy; try again in about ${Math.ceil(waitSeconds)} seconds.`);
    this.name = 'RateLimited';
    this.waitSeconds = waitSeconds;
  }
}

const rateLimitWait = (error) => {
  const body = `${error?.message || ''} ${JSON.stringify(error?.error || '')}`;
  if (!/rate_limit|429|Rate limit/i.test(body) && error?.status !== 429) return null;
  const m = body.match(/try again in ([\d.]+)\s*(ms|s|m)/i);
  if (!m) return 30;
  const n = Number(m[1]);
  return m[2] === 'ms' ? n / 1000 : m[2] === 'm' ? n * 60 : n;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Invoke a model of `kind` ("router" or "main") with optional tools.
 * Short rate-limit waits are absorbed; longer ones fall back to the next model.
 * Returns { message, model }.
 */
export const invoke = async (kind, messages, { tools, onFallback } = {}) => {
  const chain = kind === 'router' ? [config.models.router, ...config.models.main] : config.models.main;
  let longestWait = 0;
  for (const name of chain) {
    const base = kind === 'router' ? ROUTER_OPTS : MAIN_OPTS;
    const model = chat(name, optsFor(name, base));
    const runnable = tools?.length ? model.bindTools(tools) : model;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const message = await runnable.invoke(messages);
        return { message, model: name };
      } catch (error) {
        const wait = rateLimitWait(error);
        if (wait === null) throw error;
        longestWait = Math.max(longestWait, wait);
        if (wait <= config.maxRateLimitWaitSeconds && attempt === 0) {
          await sleep(wait * 1000 + 250);
          continue;
        }
        onFallback?.(name, wait);
        break;
      }
    }
  }
  throw new RateLimited(longestWait);
};

/** Injection probability for a message (0 when the guard is unavailable). */
export const guardScore = async (text) => {
  try {
    const res = await fetch(`${config.groqBaseUrl}/openai/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.models.guard, messages: [{ role: 'user', content: String(text).slice(0, 2000) }] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const score = Number(data.choices?.[0]?.message?.content);
    return Number.isFinite(score) ? score : 0;
  } catch {
    return 0;
  }
};
