const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Text; may be empty when the message only carries a card.
  message: {
    type: String,
    default: '',
  },
  // A request shown as a card in the thread, with its live status and actions.
  attachment: {
    kind: { type: String, enum: ['leave', 'event', 'correction'] },
    id: { type: mongoose.Schema.Types.ObjectId },
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  deletedForSender: { type: Boolean, default: false },
  deletedForReceiver: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Chat', ChatSchema);