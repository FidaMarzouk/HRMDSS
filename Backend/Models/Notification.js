const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.recipientRole;
    }
  },
  recipientRole: {
    type: String,
    enum: ['employee', 'manager', 'admin', 'superAdmin'],
    required: function() {
      return !this.recipient;
    }
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['leave_request', 'leave_approved', 'leave_rejected', 'leave_counter_proposal', 'attendance_correction', 'event', 'event_invitation', 'event_response', 'attendance', 'resource', 'system', 'digest'],
    required: true
  },
  // Inbox (Phase 8). `actionable`: the recipient could act on the related item
  // when it was sent; `doneAt`: set once nothing is left for them to do (the
  // item was decided, withdrawn or expired). See services/inbox.js.
  priority: { type: String, enum: ['urgent', 'normal'], default: 'normal' },
  actionable: { type: Boolean, default: false },
  doneAt: { type: Date, default: null },
  // Held for the recipient's 09:00 digest instead of being pushed right away.
  held: { type: Boolean, default: false },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '30d' // Auto-delete after 30 days
  }
});

notificationSchema.index({ recipient: 1, actionable: 1, doneAt: 1 });
notificationSchema.index({ relatedId: 1 });
notificationSchema.index({ held: 1, recipient: 1 });

module.exports = mongoose.model('Notification', notificationSchema);