// Daily digest: for people who switched it on, normal-priority notifications
// are held (not pushed) and summed up in one notification at 09:00 on working
// days. Urgent ones are never held. See services/inbox.js for priorities.
const Notification = require('../Models/Notification');
const User = require('../Models/User');
const { getIO } = require('../Middlewares/notificationService');
const inbox = require('./inbox');

const sendDigests = async () => {
  const recipients = await Notification.distinct('recipient', { held: true });
  if (!recipients.length) return { sent: 0 };
  const active = await User.find({ _id: { $in: recipients }, ...User.ACTIVE }).select('_id').lean();
  let sent = 0;
  for (const { _id } of active) {
    const held = await Notification.find({ recipient: _id, held: true }).sort({ createdAt: 1 }).lean();
    if (!held.length) continue;
    const digest = await Notification.create({
      recipient: _id,
      title: 'Your daily digest',
      message: inbox.digestMessage(held),
      type: 'digest',
      priority: 'normal',
      actionable: false,
      held: false,
    });
    await Notification.updateMany({ _id: { $in: held.map((n) => n._id) } }, { $set: { held: false } });
    const io = getIO();
    if (io) io.to(String(_id)).emit('notification', digest);
    sent++;
  }
  // Archived people's held notifications are simply released.
  await Notification.updateMany({ held: true, recipient: { $nin: active.map((u) => u._id) } }, { $set: { held: false } });
  return { sent };
};

module.exports = { sendDigests };
