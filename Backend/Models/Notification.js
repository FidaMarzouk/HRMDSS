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
    enum: ['leave_request', 'leave_approved', 'leave_rejected', 'event', 'event_invitation', 'event_response'],
    required: true
  },
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

module.exports = mongoose.model('Notification', notificationSchema);