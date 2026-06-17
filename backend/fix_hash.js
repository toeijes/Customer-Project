const bcrypt = require('bcryptjs');
const db = require('./db');

async function fixHash() {
  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Pipee_313', salt);
    await db.query('UPDATE users SET password = ? WHERE local_username = "admin"', [hash]);
    console.log('Password fixed!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
fixHash();
