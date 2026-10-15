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
}, { timestamps: true });

leaveRequestSchema.index({ employeeId: 1, startDate: 1 });
leaveRequestSchema.index({ managerId: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
