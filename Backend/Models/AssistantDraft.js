const mongoose = require('mongoose');

// Something the ENOVA Assistant prepared for a person to confirm: a leave
// request, a booking, a punch... The agent can only create drafts; the person
// confirms (or cancels) from the app, and the confirmation runs the normal
// route handler as them. Unconfirmed drafts expire.
const assistantDraftSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  threadId: { type: String, required: true, index: true },
  kind: {
    type: String,
    required: true,
    enum: ['leave_request', 'proposal_response', 'leave_decision', 'booking', 'meeting', 'mission', 'invitation_response', 'event_decision', 'punch', 'correction', 'correction_decision', 'message'],
  },
  title: { type: String, required: true, maxlength: 200 },
  // Lines shown on the confirmation card ("Dates: 15 → 16 Mar 2027").
  details: [{ label: String, value: String }],
  // Checks run before the person sees it (balance, notice, clashes...).
  checks: [{ tone: { type: String, enum: ['ok', 'warn', 'fail', 'info'] }, text: String }],
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'failed', 'expired'], default: 'pending', index: true },
  result: { type: mongoose.Schema.Types.Mixed },
  error: { type: String },
  decidedAt: Date,
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Kept 30 days for the person's history, then removed.
assistantDraftSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('AssistantDraft', assistantDraftSchema);
