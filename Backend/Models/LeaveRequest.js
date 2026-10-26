const mongoose = require('mongoose');
const { LEAVE_TYPES, LEAVE_STATUSES } = require('../constants/leave');
const { toCompanyDate } = require('../utils/time');

const leaveRequestSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // The user who must act on this request: the employee's manager, an admin (for managers) or the CEO (for admins).
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: String, enum: ['Employee', 'Manager', 'Admin'] },
  // Calendar days, stored as midnight in company time (see utils/time.js).
  startDate: { type: Date, required: true, set: toCompanyDate },
  endDate: { type: Date, required: true, set: toCompanyDate },
  reason: { type: String, enum: LEAVE_TYPES, required: true },
  status: { type: String, enum: LEAVE_STATUSES, default: 'Pending' },

  // Every step the request went through, for the approval track and audit.
  history: [{
    action: { type: String, enum: ['submitted', 'approved', 'rejected', 'undone', 'counter_proposed', 'proposal_accepted', 'proposal_declined', 'proposal_withdrawn'], required: true },
    status: { type: String }, // status after this step
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byRole: { type: String },
    at: { type: Date, default: Date.now },
    note: { type: String, maxlength: 500 },
    startDate: Date, // dates proposed or accepted at this step
    endDate: Date,
  }],

  // The latest approve/reject, kept until its undo window ends. Notifications
  // are sent only once `notified` is set (services/leaveDecisions.js).
  decision: {
    action: { type: String, enum: ['approved', 'rejected'] },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byRole: String,
    at: Date,
    undoUntil: Date,
    notified: Boolean,
    note: { type: String, maxlength: 500 },
    previous: { status: String, adminId: mongoose.Schema.Types.ObjectId, proposalStatus: String },
  },

  // Alternative dates suggested by a reviewer instead of a flat rejection.
  counterProposal: {
    startDate: { type: Date, set: toCompanyDate },
    endDate: { type: Date, set: toCompanyDate },
    note: { type: String, maxlength: 500 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byRole: String,
    at: Date,
    status: { type: String, enum: ['open', 'accepted', 'declined', 'withdrawn'] },
    respondedAt: Date,
  },
}, { timestamps: true });

leaveRequestSchema.index({ employeeId: 1, startDate: 1 });
leaveRequestSchema.index({ managerId: 1, status: 1 });
leaveRequestSchema.index({ 'decision.notified': 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
