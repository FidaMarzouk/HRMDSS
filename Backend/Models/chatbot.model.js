const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  response: {
    type: String,
    required: true
  },
  // Knowledge-base sections the answer was grounded in.
  sources: [{
    _id: false,
    file: String,
    heading: String
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

ChatMessageSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
