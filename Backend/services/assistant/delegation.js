// Delegated tokens: what the agent service uses to call the assistant tool API
// on behalf of the signed-in person. Short-lived, bound to their session, and
// only accepted on /api/assistant/tools (authMiddleware refuses them elsewhere).
// The agent never receives the person's own session cookie.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SCOPE = 'assistant';
const TTL_SECONDS = 10 * 60;

const mint = (user, threadId) =>
  jwt.sign({ id: user.id, role: user.role, sid: user.sid || null, scope: SCOPE, thread: threadId }, process.env.JWT_SECRET, { expiresIn: TTL_SECONDS });

const verify = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.scope === SCOPE ? decoded : null;
  } catch {
    return null;
  }
};

// The agent service proves who it is with a shared secret (constant-time compare).
const isAgent = (req) => {
  const expected = process.env.AGENT_SHARED_SECRET || '';
  const given = req.get('x-agent-secret') || '';
  if (!expected || expected.length !== given.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
};

module.exports = { SCOPE, TTL_SECONDS, mint, verify, isAgent };
