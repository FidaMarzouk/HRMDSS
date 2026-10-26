const mongoose = require('mongoose');

// One assistant run (a message, or a confirmation that resumed the agent), for
// observability. Metadata only: no message text, no tool arguments or results.
const assistantRunSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  role: String,
  kind: { type: String, enum: ['message', 'resume'], default: 'message' },
  page: String,
  skills: [String],
  models: { router: String, main: String },
  toolCalls: [{ name: String, ms: Number, ok: Boolean, _id: false }],
  drafts: [{ kind: String, _id: false }],
  steps: Number,
  // Times the main model was rate limited and the next model in the chain took over.
  fallbacks: { type: Number, default: 0 },
  tokens: { input: Number, output: Number },
  latencyMs: Number,
  outcome: { type: String, enum: ['answered', 'drafted', 'blocked', 'error', 'offline'] },
  guard: { flagged: Boolean, score: Number },
  error: String,
  feedback: { type: String, enum: ['up', 'down', null], default: null },
  langsmithRunId: String,
}, { timestamps: true });

assistantRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AssistantRun', assistantRunSchema);
