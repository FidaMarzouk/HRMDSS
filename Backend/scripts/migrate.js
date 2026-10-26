// Runs the data migrations in scripts/migrations, in file-name order.
//
//   npm run migrate              -> applies every migration not yet recorded
//   npm run migrate -- --dry-run -> reports what each pending migration would change, writes nothing
//
// Each migration exports { description, up({ db, dryRun, log }) } and must be safe
// to run twice. Applied migrations are recorded in the `migrations` collection.

process.env.TZ = 'Africa/Tunis';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const DIR = path.join(__dirname, 'migrations');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set. See Backend/.env.example.');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const applied = db.collection('migrations');

  const files = fs.readdirSync(DIR).filter((f) => /^\d+-.+\.js$/.test(f)).sort();
  const done = new Set((await applied.find({}, { projection: { _id: 1 } }).toArray()).map((m) => m._id));
  const pending = files.filter((f) => !done.has(f));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const file of pending) {
    const migration = require(path.join(DIR, file));
    console.log(`${DRY_RUN ? '[dry run] ' : ''}${file}: ${migration.description}`);
    const result = await migration.up({ db, dryRun: DRY_RUN, log: (msg) => console.log(`  ${msg}`) });
    if (!DRY_RUN) {
      await applied.insertOne({ _id: file, description: migration.description, appliedAt: new Date(), result: result ?? null });
    }
  }
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error('Migration failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  });
