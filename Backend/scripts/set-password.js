// Set a user's password properly (bcrypt-hashed, like the app does).
// Editing the password field directly in MongoDB stores plain text, which
// login can never match.
//
//   npm run set-password -- user@example.com             -> asks for the password
//   npm run set-password -- user@example.com --check     -> only reports whether the stored value is a valid hash
//
// The password is read from the terminal (hidden), never from the command line,
// so it does not end up in shell history.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const [email, flag] = process.argv.slice(2);
const MIN_LENGTH = 6; // same rule as Middlewares/validators.js
const isBcrypt = (value) => /^\$2[aby]\$\d{2}\$.{53}$/.test(String(value || ''));

const askHidden = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });

async function main() {
  if (!email) throw new Error('Usage: npm run set-password -- <email> [--check]');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set. See Backend/.env.example.');
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.db.collection('users');
  const user = await users.findOne({ email: email.toLowerCase().trim() }, { projection: { password: 1, firstName: 1, lastName: 1, role: 1 } });
  if (!user) throw new Error(`No user with email ${email}`);

  const label = `${user.firstName} ${user.lastName} (${user.role})`;
  if (flag === '--check') {
    console.log(`${label}: stored password is ${isBcrypt(user.password) ? 'a valid bcrypt hash' : 'NOT hashed, so login cannot work'}`);
    return;
  }

  const password = process.env.NEW_PASSWORD || (await askHidden(`New password for ${label}: `));
  if (password.length < MIN_LENGTH) throw new Error(`Password must be at least ${MIN_LENGTH} characters long.`);
  await users.updateOne({ _id: user._id }, { $set: { password: await bcrypt.hash(password, 10) }, $unset: { passwordResetTokenHash: '', passwordResetExpires: '' } });
  console.log(`Password updated for ${label}.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
