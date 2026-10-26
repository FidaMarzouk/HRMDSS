// Agent service settings, from the environment (see .env.example).
import 'dotenv/config';

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Number(v) : d);

export const config = {
  port: num(process.env.AGENT_PORT, 8090),
  backendUrl: (process.env.BACKEND_URL || 'http://localhost:8081').replace(/\/$/, ''),
  sharedSecret: process.env.AGENT_SHARED_SECRET || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  // In Docker the agent reaches Groq through the gateway (see gateway/server.js).
  groqBaseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com').replace(/\/$/, ''),
  models: {
    // Routing: a small, fast model picks the tool groups; a larger one plans and calls tools.
    router: process.env.AGENT_ROUTER_MODEL || 'openai/gpt-oss-20b',
    // A chain: the first model is used; the next ones take over when it is rate limited.
    main: (process.env.AGENT_MAIN_MODELS || process.env.AGENT_MAIN_MODEL || 'openai/gpt-oss-120b,qwen/qwen3.8-27b').split(',').map((s) => s.trim()).filter(Boolean),
    // Prompt-injection classifier run on each message (probability 0-1).
    guard: process.env.AGENT_GUARD_MODEL || 'meta-llama/llama-prompt-guard-2-86m',
  },
  guardThreshold: num(process.env.AGENT_GUARD_THRESHOLD, 0.9),
  // Rate limits: wait this long at most before falling back to the next model.
  maxRateLimitWaitSeconds: num(process.env.AGENT_MAX_RATE_LIMIT_WAIT, 12),
  // The agent keeps its own state (LangGraph checkpoints) in its own database.
  mongoUri: process.env.AGENT_MONGO_URI || 'mongodb://localhost:27017',
  mongoDb: process.env.AGENT_MONGO_DB || 'enova_agent',
  // Step budget per run (model calls); tool results are cut beyond this many characters.
  maxModelCalls: num(process.env.AGENT_MAX_MODEL_CALLS, 7),
  maxToolChars: num(process.env.AGENT_MAX_TOOL_CHARS, 5000),
  // Older turns are summarised once the conversation passes this size (characters).
  compactAfterChars: num(process.env.AGENT_COMPACT_AFTER_CHARS, 24000),
  keepRecentMessages: num(process.env.AGENT_KEEP_RECENT_MESSAGES, 8),
};

export const assertConfigured = () => {
  const missing = [];
  if (!config.sharedSecret) missing.push('AGENT_SHARED_SECRET');
  if (!config.groqApiKey) missing.push('GROQ_API_KEY');
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')} (see Agent/.env.example)`);
};
