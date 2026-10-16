// Archived accounts, kept in memory so every request and socket can be refused
// without a database lookup. Session tokens are stateless JWTs, so this is what
// ends an archived person's session before the token expires.
const archived = new Set();

const load = async () => {
  const User = require('../Models/User');
  const rows = await User.find({ status: 'archived' }).select('_id').lean();
  archived.clear();
  rows.forEach((r) => archived.add(String(r._id)));
  return archived.size;
};

const isArchived = (userId) => archived.has(String(userId));

const setArchived = (userId, value) => {
  if (value) archived.add(String(userId));
  else archived.delete(String(userId));
};

module.exports = { load, isArchived, setArchived };
