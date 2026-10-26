// Skills were plain strings; they become { name, level?, validatedBy? }.
// The User model also converts legacy values as they load, so the app works
// before and after this migration; this rewrites the stored data once.
const { normalizeSkills } = require('../../utils/skills');

module.exports = {
  description: 'Store skills as { name, level } objects instead of plain strings',

  async up({ db, dryRun, log }) {
    const users = db.collection('users');
    const ops = [];
    for await (const user of users.find({ skills: { $elemMatch: { $type: 'string' } } }, { projection: { skills: 1 } })) {
      ops.push({ updateOne: { filter: { _id: user._id }, update: { $set: { skills: normalizeSkills(user.skills) } } } });
    }
    log(`users: ${ops.length} document(s) ${dryRun ? 'would change' : 'updated'}`);
    if (!dryRun && ops.length) await users.bulkWrite(ops, { ordered: false });
    return { users: ops.length };
  },
};
