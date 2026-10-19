const mongoose = require('mongoose');

// One record per sign-in, referenced from the JWT (`sid`), so sessions can be
// listed per device and ended before the token expires ("sign out other
// devices", password change, archive). Expired records are removed by MongoDB.
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokedReason: { type: String, enum: ['logout', 'signed_out_elsewhere', 'password_changed', 'password_reset', null], default: null },
  // A short label ("Chrome on Windows") and a coarse address, for the sessions list.
  device: { type: String, maxlength: 80 },
  ip: { type: String, maxlength: 64 },
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
