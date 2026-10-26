const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, 
  name: { type: String, required: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Most people who may be away on the same working day. Empty = 25% of the
  // team, rounded, at least 1 (constants/leave.js DEFAULT_COVERAGE_RATIO).
  coverageLimit: { type: Number, min: 1, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);