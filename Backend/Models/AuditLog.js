const mongoose = require('mongoose');

// Who did what, to whom, and when. Written by services/audit.js; shown in a
// person's History tab. Entries are never edited or deleted by the app.
const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorRole: String,
  // e.g. "user.update", "user.salary_reveal", "user.archive", "leave.approve"
  action: { type: String, required: true },
  entity: { type: String, required: true }, // "User" | "LeaveRequest" | "Department"
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  // The person the entry is about, so each profile can show its own history.
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  summary: { type: String, required: true, maxlength: 300 },
  // Field-level changes; sensitive values (salary, password) are recorded as "changed".
  changes: [{ field: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed, _id: false }],
  reason: { type: String, maxlength: 500 },
  ip: String,
  at: { type: Date, default: Date.now },
});

auditLogSchema.index({ subject: 1, at: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, at: -1 });
auditLogSchema.index({ actor: 1, at: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
