const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const json = (message) => ({ message });

// Brute-force protection for credential endpoints (per IP).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many attempts. Please try again in a few minutes.'),
});

// Keeps assistant usage (and LLM cost) bounded per user.
const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.id) || ipKeyGenerator(req.ip),
  message: { success: false, message: 'You are sending messages too quickly. Please wait a moment.' },
});

module.exports = { authLimiter, chatbotLimiter };
