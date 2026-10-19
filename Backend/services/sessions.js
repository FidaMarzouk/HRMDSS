// Sign-in sessions behind the stateless JWT. The token carries the session id
// (`sid`); ended sessions are kept in memory so every request and socket can be
// refused without a database lookup, like archived accounts (accountStatus.js).
const Session = require('../Models/Session');

const revoked = new Set();
const lastTouch = new Map();
const TOUCH_EVERY_MS = 5 * 60 * 1000;

// "Chrome on Windows", "Safari on iPhone"... from the User-Agent header.
const describeDevice = (ua = '') => {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl|node|axios|fetch/i.test(ua) ? 'Script' : 'Browser';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
};

// Keep the first parts of the address only (enough to recognise a network).
const coarseIp = (ip = '') => {
  const v4 = String(ip).replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 3).join('.') + '.x';
  if (v4 === '::1') return 'this computer';
  return v4.split(':').slice(0, 3).join(':') + (v4.includes(':') ? ':…' : '');
};

const load = async () => {
  const rows = await Session.find({ revokedAt: { $ne: null }, expiresAt: { $gt: new Date() } }).select('_id').lean();
  revoked.clear();
  rows.forEach((r) => revoked.add(String(r._id)));
  return revoked.size;
};

const create = async ({ userId, expiresAt, userAgent, ip }) =>
  Session.create({ userId, expiresAt, device: describeDevice(userAgent).slice(0, 80), ip: coarseIp(ip).slice(0, 64) });

// Tokens issued before sessions existed have no sid: they stay valid until they expire.
const isActive = (sid) => !sid || !revoked.has(String(sid));

// Record activity, at most every few minutes per session; never blocks a request.
const touch = (sid) => {
  if (!sid) return;
  const now = Date.now();
  if (now - (lastTouch.get(sid) || 0) < TOUCH_EVERY_MS) return;
  lastTouch.set(sid, now);
  Session.updateOne({ _id: sid, revokedAt: null }, { $set: { lastSeenAt: new Date(now) } }).catch(() => {});
};

const revoke = async (filter, reason) => {
  const rows = await Session.find({ ...filter, revokedAt: null }).select('_id').lean();
  if (!rows.length) return 0;
  await Session.updateMany({ _id: { $in: rows.map((r) => r._id) } }, { $set: { revokedAt: new Date(), revokedReason: reason } });
  rows.forEach((r) => revoked.add(String(r._id)));
  endSockets(new Set(rows.map((r) => String(r._id))), reason);
  return rows.length;
};

// Close the live connections of ended sessions and tell those tabs why.
const endSockets = (sids, reason) => {
  const { getIO } = require('../Middlewares/notificationService'); // lazy: that module requires this one
  const io = getIO();
  if (!io) return;
  io.sockets.sockets.forEach((socket) => {
    if (sids.has(String(socket.user?.sid))) {
      socket.emit('session:ended', { reason });
      socket.disconnect(true);
    }
  });
};

const revokeOne = (userId, sid, reason = 'logout') => revoke({ _id: sid, userId }, reason);
const revokeOthers = (userId, keepSid, reason = 'signed_out_elsewhere') => revoke({ userId, ...(keepSid ? { _id: { $ne: keepSid } } : {}) }, reason);

const listActive = (userId) =>
  Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).select('createdAt lastSeenAt expiresAt device ip').lean();

module.exports = { load, create, isActive, touch, revokeOne, revokeOthers, listActive, describeDevice, coarseIp };
