// Groq client (OpenAI-compatible chat completions with tool calling). Model set by GROQ_MODEL.
const Groq = require('groq-sdk');

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

let client = null;

const isConfigured = () => Boolean(process.env.GROQ_API_KEY);

const getClient = () => {
  if (!client) {
    // The SDK retries 429 rate-limit responses after the delay Groq asks for.
    client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 45_000, maxRetries: 3 });
  }
  return client;
};

const chat = (params) => getClient().chat.completions.create({
  model: MODEL,
  temperature: 0.2,
  max_tokens: 900,
  ...params,
});

module.exports = { MODEL, isConfigured, chat };
