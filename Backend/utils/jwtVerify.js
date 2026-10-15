const jwt = require('jsonwebtoken');

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      success: true,
      user: {
        id: decoded.id || decoded._id || decoded.userId,
        role: decoded.role,
        ...decoded
      }
    };
  } catch (error) {
    return {
      success: false,
      error
    };
  }
};

module.exports = verifyToken;