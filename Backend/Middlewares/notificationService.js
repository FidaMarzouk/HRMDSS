const socketIO = require('socket.io');
const { parseCookie } = require('cookie');
const Notification = require('../Models/Notification');
const User = require('../Models/User');
const verifyToken = require('../utils/jwtVerify');
const accountStatus = require('../services/accountStatus');
let io;

// The browser cannot read the httpOnly auth cookie, but it is sent with the
// socket handshake, so authenticate from it (falling back to an explicit token).
const getHandshakeToken = (socket) => {
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookie(cookieHeader);
    if (cookies.authToken) return cookies.authToken;
  }
  return socket.handshake.auth && socket.handshake.auth.token;
};

// Initialize Socket.IO with the HTTP server
const initializeSocket = (server, origin) => {
  io = socketIO(server, {
    cors: {
      origin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = getHandshakeToken(socket);
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    const result = verifyToken(token);
    if (!result.success) {
      const expired = result.error.name === 'TokenExpiredError';
      return next(new Error(expired ? 'Token expired' : 'Authentication error: Invalid token'));
    }

    if (accountStatus.isArchived(result.user.id)) {
      return next(new Error('Authentication error: Account archived'));
    }

    socket.user = result.user;
    next();
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user.id);
    const userRole = socket.user.role;

    socket.join(userId);
    if (userRole) {
      socket.join(userRole);
    }
  });

  return io;
};

const buildNotification = (recipient, notification) => ({
  recipient,
  title: notification.title,
  message: notification.message,
  type: notification.type,
  relatedId: notification.relatedId,
  isRead: false
});

// Send notification to specific user
const sendNotificationToUser = async (userId, notification) => {
  try {
    const newNotification = await Notification.create(buildNotification(userId, notification));
    if (io) {
      io.to(String(userId)).emit('notification', newNotification);
    }
    return newNotification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

// Send notification to every user with a role. One record per user so that
// read/delete state is tracked individually.
const sendNotificationToRole = async (role, notification) => {
  try {
    const users = await User.find({ role, ...User.ACTIVE }).select('_id').lean();
    if (users.length === 0) return [];

    const created = await Notification.insertMany(
      users.map((u) => buildNotification(u._id, notification))
    );
    if (io) {
      created.forEach((n) => io.to(String(n.recipient)).emit('notification', n));
    }
    return created;
  } catch (error) {
    console.error('Error sending role notification:', error);
    throw error;
  }
};

// Tell every signed-in client that something changed (no data: clients refetch
// what they are allowed to see). Events: "presence:changed", "queue:changed".
const broadcast = (event) => {
  if (io) io.emit(event);
};

// Route middleware: broadcast `event` after a successful write.
const broadcastOnSuccess = (event) => (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400) broadcast(event);
  });
  next();
};

module.exports = {
  initializeSocket,
  sendNotificationToUser,
  sendNotificationToRole,
  broadcast,
  broadcastOnSuccess,
  getIO: () => io
};
