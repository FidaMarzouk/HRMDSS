const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  type: { 
    type: String,
    enum: ['desktop', 'meetingRoom', 'office', 'robot', 'toolKit', 'testingEquipment', 'prototype'],
    required: true
  },
  description: { 
    type: String,
    trim: true
  },
  status: { 
    type: String,
    enum: ['available', 'maintenance'],
    default: 'available'
  },
}, { timestamps: true });

// Indexes for faster queries
resourceSchema.index({ type: 1 });
resourceSchema.index({ status: 1 });

module.exports = mongoose.model('Resource', resourceSchema);