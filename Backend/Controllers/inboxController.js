// Inbox: notifications split into "needs action" and "for information", with
// live actions on the related item, and the daily digest preference.
const mongoose = require('mongoose');
const Notification = require('../Models/Notification');
const User = require('../Models/User');
const inbox = require('../services/inbox');

const LIMIT = 60;

// GET /api/inbox?box=action|info
exports.getInbox = async (req, res) => {
  try {
    const box = req.query.box === 'info' ? 'info' : 'action';
    const userId = req.user.id;
    const me = await User.findById(userId).select('departmentId preferences').lean();
    const actionFilter = { recipient: userId, actionable: true, doneAt: null };
    const infoFilter = { recipient: userId, $or: [{ actionable: { $ne: true } }, { doneAt: { $ne: null } }] };

    const rows = await Notification.find(box === 'action' ? actionFilter : infoFilter).sort({ createdAt: -1 }).limit(LIMIT).lean();
    const refs = rows.map((n) => ({ kind: inbox.kindOfType(n.type), id: n.relatedId })).filter((r) => r.kind && r.id);
    const items = await inbox.loadItems(refs);

    const viewer = { id: String(userId), role: req.user.role };
    const done = [];
    const list = rows
      .map((n) => {
        const kind = inbox.kindOfType(n.type);
        const item = kind && n.relatedId ? items.get(`${kind}:${String(n.relatedId)}`) : null;
        const card = kind && n.relatedId ? inbox.cardFor(kind, item, viewer, me?.departmentId) : null;
        // Decided, withdrawn or deleted since it was sent: no longer needs action.
        if (box === 'action' && !(card?.actions?.length)) {
          done.push(n._id);
          return null;
        }
        return { ...n, card };
      })
      .filter(Boolean);
    if (done.length) await Notification.updateMany({ _id: { $in: done } }, { $set: { doneAt: new Date() } });

    const [action, infoUnread] = await Promise.all([
      Notification.countDocuments(actionFilter),
      Notification.countDocuments({ ...infoFilter, isRead: false }),
    ]);
    res.json({ box, notifications: list, counts: { action, infoUnread }, preferences: { digest: Boolean(me?.preferences?.digest) } });
  } catch (error) {
    console.error('Error loading inbox:', error);
    res.status(500).json({ message: 'Could not load the inbox' });
  }
};

// PUT /api/inbox/preferences { digest }
exports.updatePreferences = async (req, res) => {
  try {
    if (typeof req.body?.digest !== 'boolean') return res.status(400).json({ message: 'digest must be true or false' });
    await User.updateOne({ _id: req.user.id }, { $set: { 'preferences.digest': req.body.digest } });
    // Switching the digest off delivers what was waiting for it.
    if (!req.body.digest) await Notification.updateMany({ recipient: req.user.id, held: true }, { $set: { held: false } });
    res.json({ preferences: { digest: req.body.digest } });
  } catch (error) {
    console.error('Error saving inbox preferences:', error);
    res.status(500).json({ message: 'Could not save the preference' });
  }
};

// PUT /api/inbox/read { box: "info" } marks the information box read.
exports.markBoxRead = async (req, res) => {
  try {
    const filter = { recipient: req.user.id, isRead: false, $or: [{ actionable: { $ne: true } }, { doneAt: { $ne: null } }] };
    const result = await Notification.updateMany(filter, { $set: { isRead: true } });
    res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error marking inbox read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/inbox/cards?refs=leave:<id>,event:<id>: cards for chat attachments.
exports.getCards = async (req, res) => {
  try {
    const refs = String(req.query.refs || '')
      .split(',')
      .slice(0, 50)
      .map((r) => {
        const [kind, id] = r.split(':');
        return { kind, id };
      })
      .filter((r) => ['leave', 'event', 'correction'].includes(r.kind) && mongoose.isValidObjectId(r.id));
    const me = await User.findById(req.user.id).select('departmentId').lean();
    const items = await inbox.loadItems(refs);
    const viewer = { id: String(req.user.id), role: req.user.role };
    res.json({
      cards: Object.fromEntries(refs.map((r) => [`${r.kind}:${r.id}`, inbox.cardFor(r.kind, items.get(`${r.kind}:${r.id}`), viewer, me?.departmentId)])),
    });
  } catch (error) {
    console.error('Error loading cards:', error);
    res.status(500).json({ message: 'Could not load the cards' });
  }
};
