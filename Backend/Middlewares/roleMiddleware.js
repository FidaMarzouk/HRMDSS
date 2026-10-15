// roleMiddleware.js (updated)
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Access denied. User role not found.' });
    }

    // Convert allowedRoles to array if it's a string
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Check if the user's role is in the allowed roles array
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};
module.exports = roleMiddleware;