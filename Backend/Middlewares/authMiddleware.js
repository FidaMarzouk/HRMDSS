const verifyToken = require('../utils/jwtVerify');
const accountStatus = require('../services/accountStatus');
const sessions = require('../services/sessions');

const authMiddleware = (req, res, next) => {
  // Prefer the httpOnly cookie, fall back to a Bearer header.
  const cookieToken = req.cookies && req.cookies.authToken;
  const authHeader = req.header('Authorization');
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const result = verifyToken(token);
  if (!result.success) {
    const expired = result.error.name === 'TokenExpiredError';
    return res.status(401).json({ message: expired ? 'Session expired.' : 'Invalid token.' });
  }

  // Archiving ends a session at once, before the token would expire.
  if (accountStatus.isArchived(result.user.id)) {
    return res.status(401).json({ message: 'This account has been archived.' });
  }

  // Signed out from another device, or after a password change.
  if (!sessions.isActive(result.user.sid)) {
    return res.status(401).json({ message: 'This session has been signed out.' });
  }
  sessions.touch(result.user.sid);

  req.user = result.user;
  next();
};

module.exports = authMiddleware;
