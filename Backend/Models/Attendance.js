const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  sessionNumber: { 
    type: Number,
    default: 1
  },
  checkIn: {
    type: Date,
    required: function() {
      return this.status !== 'Absent';
    }
  },
  checkOut: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Late'],
  },
  breaks: [{
    startTime: Date,
    endTime: Date,
    duration: Number // in minutes
  }],
  earlyBy: {
    type: Number, // in minutes
    default: 0
  },
  lateBy: {
    type: Number, // in minutes
    default: 0
  },
  overtime: {
    type: Number, // in minutes
    default: 0
  },
  productionHours: {
    type: Number, // in hours
    default: 0
  }
});

attendanceSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);