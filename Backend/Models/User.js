const mongoose = require('mongoose');
const { toCompanyDate } = require('../utils/time');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  position: { type: String, required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to manager
  hireDate: { type: Date, required: true, set: toCompanyDate },
  salary: { type: Number, required: true },
  leaveRequestAllowed: { type: Number},
  remainingLeaveDays: { type: Number },
  skills: { type: [String], required: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'manager', 'employee','superAdmin'], default: 'employee' },
  profilePicture: { type: String, default: '' },
  birthdate: { type: Date, set: toCompanyDate },
  age: { type: Number },
  personalEmail: { type: String },
  // Single-use password reset / account setup token (stored hashed).
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false }
}, { timestamps: true });

// Middleware to check if the managerId points to a valid manager
userSchema.pre('save', async function(next) {
  if (this.managerId) {
    const manager = await mongoose.model('User').findById(this.managerId);
    if (!manager || manager.role !== 'manager') {
      return next(new Error('Manager not found or the user is not a manager'));
    }
  }
  next();
});

// Middleware to validate managerId before updating
userSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update.managerId) {
    const manager = await mongoose.model('User').findById(update.managerId);
    if (!manager || manager.role !== 'manager') {
      return next(new Error('Manager not found or the user is not a manager'));
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);