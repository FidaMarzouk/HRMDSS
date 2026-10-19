const socketIO = require('socket.io');
const { parseCookie } = require('cookie');
const Notification = require('../Models/Notification');
const User = require('../Models/User');
const verifyToken = require('../utils/jwtVerify');
const accountStatus = require('../services/accountStatus');
const inbox = require('../services/inbox');
const sessions = require('../services/sessions');
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
    if (!sessions.isActive(result.user.sid)) {
      return next(new Error('Authentication error: Session signed out'));
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

/**
 * One record per recipient, with what the inbox needs: whether they can act on
 * the related item (actionable), how urgent it is, and whether it waits for
 * their 09:00 digest (held: normal priority and the digest switched on).
 */
const prepare = async (recipientIds, notification) => {
  const kind = inbox.kindOfType(notification.type);
  const item = kind && notification.relatedId
    ? (await inbox.loadItems([{ kind, id: notification.relatedId }])).get(`${kind}:${String(notification.relatedId)}`)
    : null;
  const users = await User.find({ _id: { $in: recipientIds } }).select('role preferences').lean();
  const quietNow = new Set(users.filter((u) => inQuietHours(u.preferences?.quietHours)).map((u) => String(u._id)));
  const docs = users.map((u) => {
    const actionable = item ? inbox.actionsFor(kind, item, { id: String(u._id), role: u.role }).length > 0 : false;
    const priority = notification.priority || inbox.priorityOf(kind, item, { actionable });
    return { ...buildNotification(u._id, notification), actionable, priority, held: priority === 'normal' && Boolean(u.preferences?.digest) };
  });
  return { docs, quietNow };
};

// True when `now` (company time) falls inside the person's quiet hours.
// A range like 19:00 -> 08:00 wraps around midnight.
const inQuietHours = (quiet, now = new Date()) => {
  if (!quiet?.enabled || !quiet.from || !quiet.to) return false;
  const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const m = now.getHours() * 60 + now.getMinutes();
  const from = toMin(quiet.from);
  const to = toMin(quiet.to);
  if (from === to) return false;
  return from < to ? m >= from && m < to : m >= from || m < to;
};

// Push to the recipients' sockets, except those held for the digest. During
// quiet hours non-urgent ones are sent silently (badges update, no pop-up).
const push = (created, quietNow = new Set()) => {
  if (!io) return;
  created
    .filter((n) => !n.held)
    .forEach((n) => {
      const payload = typeof n.toObject === 'function' ? n.toObject() : n;
      const silent = n.priority !== 'urgent' && quietNow.has(String(n.recipient));
      io.to(String(n.recipient)).emit('notification', silent ? { ...payload, silent: true } : payload);
    });
};

// Send notification to specific user
const sendNotificationToUser = async (userId, notification) => {
  try {
    const { docs, quietNow } = await prepare([userId], notification);
    if (!docs[0]) return null;
    const newNotification = await Notification.create(docs[0]);
    push([newNotification], quietNow);
    // The item changed: earlier notifications about it may no longer need action.
    await inbox.refresh(notification.relatedId);
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

    const { docs, quietNow } = await prepare(users.map((u) => u._id), notification);
    const created = await Notification.insertMany(docs);
    push(created, quietNow);
    await inbox.refresh(notification.relatedId);
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
  inQuietHours,
  initializeSocket,
  sendNotificationToUser,
  sendNotificationToRole,
  broadcast,
  broadcastOnSuccess,
  getIO: () => io
};
