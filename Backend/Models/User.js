const mongoose = require('mongoose');
const { toCompanyDate } = require('../utils/time');
const { normalizeSkills } = require('../utils/skills');

// A skill with an optional 1-5 level; validatedBy is the manager or HR person
// who confirmed the level.
const skillSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  level: { type: Number, min: 1, max: 5 },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  validatedAt: Date,
}, { _id: false });

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
  // Plain names are accepted and converted (see utils/skills.js).
  skills: { type: [skillSchema], default: [], set: normalizeSkills },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'manager', 'employee','superAdmin'], default: 'employee' },
  profilePicture: { type: String, default: '' },
  birthdate: { type: Date, set: toCompanyDate },
  age: { type: Number },
  personalEmail: { type: String },
  // Single-use password reset / account setup token (stored hashed).
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },

  // Archived people keep their history but cannot sign in and are left out of
  // lists, counts and scheduled jobs. Nothing is deleted.
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  archivedAt: Date,
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  archiveReason: { type: String, maxlength: 500 },

  // Personal settings (Profile). digest: low-urgency notifications are
  // collected into one 09:00 summary on working days. theme: follows the person
  // on every device; "shift" = light during your working day, dark once you
  // have punched out. quietHours: no pop-ups for non-urgent notifications.
  preferences: {
    digest: { type: Boolean, default: false },
    // Unset until the person chooses: their device's choice is then saved here.
    theme: { type: String, enum: ['light', 'dark', 'auto', 'shift'] },
    quietHours: {
      enabled: { type: Boolean, default: false },
      from: { type: String, default: '19:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      to: { type: String, default: '08:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    },
  },
}, { timestamps: true });

userSchema.index({ status: 1 });

// Documents written before skills had levels store plain strings; convert them
// as they load so they are never cast into broken subdocuments (migration 002
// converts the stored data).
userSchema.pre('init', function normalizeLegacySkills(doc) {
  if (Array.isArray(doc.skills) && doc.skills.some((s) => typeof s === 'string')) {
    doc.skills = normalizeSkills(doc.skills);
  }
});

// Filter for everyone who has not been archived (missing status = active).
userSchema.statics.ACTIVE = Object.freeze({ status: { $ne: 'archived' } });

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