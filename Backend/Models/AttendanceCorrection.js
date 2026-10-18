const mongoose = require('mongoose');
const { toCompanyDate } = require('../utils/time');

// An employee asks for a punch to be fixed; their approver (manager, HR for
// managers, the CEO for HR) accepts or rejects it. Approving changes the
// attendance record (see Controllers/timeController.js).
const attendanceCorrectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterRole: { type: String, enum: ['employee', 'manager', 'admin'], required: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, set: toCompanyDate }, // the day being corrected
  // missing_punch_out: close an open session; missing_punch_in: add a forgotten
  // session; wrong_times: change the times of a recorded session.
  kind: { type: String, enum: ['missing_punch_out', 'missing_punch_in', 'wrong_times'], required: true },
  attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
  checkIn: Date,
  checkOut: Date,
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
  note: { type: String, maxlength: 500 },
}, { timestamps: true });

attendanceCorrectionSchema.index({ reviewerId: 1, status: 1 });
attendanceCorrectionSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('AttendanceCorrection', attendanceCorrectionSchema);
