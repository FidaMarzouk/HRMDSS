// Date-only fields used to be stored two ways: the seed wrote midnight in Tunis
// (e.g. 2017-03-20T23:00Z for 21 March) while forms sent "YYYY-MM-DD", stored as
// UTC midnight (2017-03-21T00:00Z). Both now become midnight in company time.
const { toCompanyDate } = require('../../utils/time');

const FIELDS = {
  users: ['hireDate', 'birthdate'],
  leaverequests: ['startDate', 'endDate'],
};

module.exports = {
  description: 'Store hire dates, birthdates and leave dates as midnight in company time',

  async up({ db, dryRun, log }) {
    const changed = {};
    for (const [collection, fields] of Object.entries(FIELDS)) {
      const ops = [];
      const projection = Object.fromEntries(fields.map((f) => [f, 1]));
      for await (const doc of db.collection(collection).find({}, { projection })) {
        const set = {};
        for (const field of fields) {
          if (!(doc[field] instanceof Date)) continue;
          const normalized = toCompanyDate(doc[field]);
          if (normalized.getTime() !== doc[field].getTime()) set[field] = normalized;
        }
        if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
      }
      changed[collection] = ops.length;
      log(`${collection}: ${ops.length} document(s) ${dryRun ? 'would change' : 'updated'}`);
      if (!dryRun && ops.length) await db.collection(collection).bulkWrite(ops, { ordered: false });
    }
    return changed;
  },
};
