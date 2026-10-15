const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, 
  name: { type: String, required: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);