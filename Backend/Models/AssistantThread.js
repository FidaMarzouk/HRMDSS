const mongoose = require('mongoose');

// A person's current conversation with the assistant. Its messages live in the
// agent service's own database (LangGraph checkpoints), not in HR data.
const assistantThreadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  threadId: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  // Kept for the panel's history list (first question, shortened).
  title: { type: String, maxlength: 120 },
}, { timestamps: true });

module.exports = mongoose.model('AssistantThread', assistantThreadSchema);
