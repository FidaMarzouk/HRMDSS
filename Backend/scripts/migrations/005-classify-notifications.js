// The inbox (Phase 8) splits notifications into "needs action" and "for
// information", and the bell counts only the first. Notifications sent before
// it have no `actionable` flag; this works it out from the related item's
// current state, for each recipient, with the same rules as new ones.
const inbox = require('../../services/inbox');

module.exports = {
  description: 'Mark existing notifications that still need action from their recipient',

  async up({ db, dryRun, log }) {
    const notes = await db.collection('notifications').find({ actionable: { $exists: false } }).project({ recipient: 1, type: 1, relatedId: 1 }).toArray();
    const refs = notes.map((n) => ({ kind: inbox.kindOfType(n.type), id: n.relatedId })).filter((r) => r.kind && r.id);
    const items = await inbox.loadItems(refs);
    const users = await db.collection('users').find({ _id: { $in: notes.map((n) => n.recipient) } }).project({ role: 1 }).toArray();
    const roleOf = new Map(users.map((u) => [String(u._id), u.role]));
    let actionable = 0;
    const ops = notes.map((n) => {
      const kind = inbox.kindOfType(n.type);
      const item = kind && n.relatedId ? items.get(`${kind}:${String(n.relatedId)}`) : null;
      const can = item ? inbox.actionsFor(kind, item, { id: String(n.recipient), role: roleOf.get(String(n.recipient)) }).length > 0 : false;
      if (can) actionable++;
      return { updateOne: { filter: { _id: n._id }, update: { $set: { actionable: can, doneAt: null, held: false, priority: inbox.priorityOf(kind, item, { actionable: can }) } } } };
    });
    log(`notifications: ${notes.length} classified, ${actionable} still need action ${dryRun ? '(would change)' : '(updated)'}`);
    if (!dryRun && ops.length) await db.collection('notifications').bulkWrite(ops, { ordered: false });
    return { notifications: notes.length, actionable };
  },
};
