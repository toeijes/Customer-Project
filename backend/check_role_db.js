const db = require('./db');

async function run() {
  try {
    const rows = await db.query("SHOW COLUMNS FROM users LIKE 'role'");
    console.log(rows[0].Type);
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
