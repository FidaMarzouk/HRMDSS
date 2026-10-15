const crypto = require('crypto');

const RESET_TTL_MS = 10 * 60 * 1000;          // forgot-password links
const ACCOUNT_SETUP_TTL_MS = 24 * 60 * 60 * 1000; // welcome / set-password links

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Generates a single-use token, stores only its hash on the user document and
// returns the raw token for the email link. Caller must save the user.
const issuePasswordToken = (user, ttlMs) => {
  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpires = new Date(Date.now() + ttlMs);
  return token;
};

const passwordLink = (token) => `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`;

module.exports = { RESET_TTL_MS, ACCOUNT_SETUP_TTL_MS, hashToken, issuePasswordToken, passwordLink };
