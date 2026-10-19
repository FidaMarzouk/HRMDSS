const User = require('../Models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');
const { RESET_TTL_MS, hashToken, issuePasswordToken, passwordLink } = require('../utils/passwordTokens');
const sessions = require('../services/sessions');
const verifyJwt = require('../utils/jwtVerify');
const { sendNotificationToUser } = require('../Middlewares/notificationService');

const SESSION_SECONDS = 5 * 60 * 60; // 5 hours

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/'
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Same response for unknown email and wrong password, to avoid account enumeration.
    const user = await User.findOne({ email: String(email).trim(), ...User.ACTIVE }).select('+password');
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // A session record per sign-in (listed on the profile, can be ended early).
    const session = await sessions.create({
      userId: user._id,
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    const token = jwt.sign({ id: user._id, role: user.role, sid: String(session._id) }, process.env.JWT_SECRET, { expiresIn: SESSION_SECONDS });

    res.cookie('authToken', token, { ...authCookieOptions, maxAge: SESSION_SECONDS * 1000 });

    res.status(200).json({
      message: 'Login successful',
      expiresIn: SESSION_SECONDS,
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(),
      role: user.role,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.logout = async (req, res) => {
  // End this session on the server too, so the token cannot be reused.
  const token = req.cookies && req.cookies.authToken;
  const result = token ? verifyJwt(token) : null;
  if (result?.success && result.user.sid) {
    await sessions.revokeOne(result.user.id, result.user.sid, 'logout').catch(() => {});
  }
  res.clearCookie('authToken', authCookieOptions);
  res.status(200).json({ message: 'Logged out' });
};

// GET /api/auth/sessions: this person's active sessions, the current one first.
exports.listSessions = async (req, res) => {
  try {
    const rows = await sessions.listActive(req.user.id);
    const current = String(req.user.sid || '');
    const list = rows.map((s) => ({ id: String(s._id), device: s.device, ip: s.ip, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, current: String(s._id) === current }));
    list.sort((a, b) => Number(b.current) - Number(a.current));
    res.json({ sessions: list, legacy: !current });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/auth/sessions/:id: end one of your sessions.
exports.endSession = async (req, res) => {
  try {
    if (!require('mongoose').isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Session not found' });
    const n = await sessions.revokeOne(req.user.id, req.params.id, 'signed_out_elsewhere');
    if (!n) return res.status(404).json({ message: 'Session not found' });
    if (String(req.params.id) === String(req.user.sid)) res.clearCookie('authToken', authCookieOptions);
    res.json({ ended: n });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/sessions/sign-out-others: end every session except this one.
exports.signOutOthers = async (req, res) => {
  try {
    const n = await sessions.revokeOthers(req.user.id, req.user.sid || null, 'signed_out_elsewhere');
    res.json({ ended: n });
  } catch (error) {
    console.error('Error signing out other sessions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyToken = (req, res) => {
  res.status(200).json({
    authenticated: true,
    user: { id: req.user.id, role: req.user.role }
  });
};

exports.requestPasswordReset = async (req, res) => {
  const genericResponse = { message: 'If your email is registered, you will receive a password reset link.' };
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Archived accounts get the generic answer and no email.
    const user = await User.findOne({ email: String(email).trim(), ...User.ACTIVE });
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const token = issuePasswordToken(user, RESET_TTL_MS);
    await user.save();

    try {
      await emailService.sendPasswordResetEmail({
        email: user.personalEmail || user.email,
        firstName: user.firstName,
        resetUrl: passwordLink(token)
      });
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      return res.status(500).json({ message: 'Could not send the reset email. Please contact HR.' });
    }

    res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Error in requestPasswordReset:', error);
    res.status(500).json({ message: 'Error processing your request' });
  }
};

const findUserByResetToken = (token) =>
  User.findOne({
    ...User.ACTIVE,
    passwordResetTokenHash: hashToken(String(token)),
    passwordResetExpires: { $gt: new Date() }
  }).select('+passwordResetTokenHash +passwordResetExpires');

exports.verifyResetToken = async (req, res) => {
  try {
    const user = await findUserByResetToken(req.params.token);
    if (!user) {
      return res.status(401).json({ message: 'Token is invalid or expired' });
    }
    res.status(200).json({ valid: true, email: user.email });
  } catch (error) {
    console.error('Error in verifyResetToken:', error);
    res.status(500).json({ message: 'Error processing your request' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({ message: 'Both password fields are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await findUserByResetToken(req.params.token);
    if (!user) {
      return res.status(401).json({ message: 'Token is invalid or expired' });
    }

    // Single use: clear the token together with the password change.
    user.password = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Whoever had the old password is signed out everywhere.
    await sessions.revokeOthers(user._id, null, 'password_reset');
    sendNotificationToUser(user._id, {
      title: 'Your password was reset',
      message: 'Your password was changed with a reset link and every device was signed out. If this was not you, contact HR right away.',
      type: 'system',
      priority: 'urgent',
    }).catch(() => {});

    // The reset already succeeded; a failed confirmation email must not turn it into an error.
    emailService.sendPasswordResetConfirmation({
      email: user.personalEmail || user.email,
      firstName: user.firstName
    }).catch((err) => console.error('Error sending password reset confirmation:', err));

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ message: 'Error processing your request' });
  }
};
