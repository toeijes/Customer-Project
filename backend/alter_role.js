const db = require('./db');

async function run() {
  try {
    await db.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) DEFAULT 'user'");
    console.log('Successfully altered users.role to VARCHAR(50)');
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
