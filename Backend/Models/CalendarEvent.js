const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  // Common fields for all event types
  title: { type: String, required: true },
  eventType: { 
    type: String, 
    enum: ['meeting', 'mission', 'resourceReservation'],
  },
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  visibility: { 
    type: String, 
    enum: ['public', 'private', 'department'],
    default: 'public'
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'declined'],
    default: 'pending'
  },
  departmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department'
  },
  
  // Meeting specific fields
  description: { type: String },
  location: { type: String },
  
  // Mission specific fields
  destination: { type: String },
  
  // Resource reservation specific fields
  resource: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Resource'
  },
  description: { type: String },
  
  // Users involved (for meetings and missions)
  usersInvolved: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { 
      type: String, 
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    }
  }],
  
  // Admin actions tracking
  adminActions: {
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    declinedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    declinedAt: { type: Date },
  }
}, { timestamps: true });

// Indexes for faster queries
calendarEventSchema.index({ startDateTime: 1, endDateTime: 1 });
calendarEventSchema.index({ createdBy: 1 });
calendarEventSchema.index({ departmentId: 1 });
calendarEventSchema.index({ 'usersInvolved.userId': 1 });
calendarEventSchema.index({ eventType: 1 });
calendarEventSchema.index({ resource: 1 });
calendarEventSchema.index({ status: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);