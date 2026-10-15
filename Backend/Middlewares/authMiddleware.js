const verifyToken = require('../utils/jwtVerify');

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

  req.user = result.user;
  next();
};

module.exports = authMiddleware;
