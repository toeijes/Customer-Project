const db = require('./db');

async function test() {
  try {
    const results = await db.query('SELECT * FROM users WHERE local_username = "admin"');
    console.log(results);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
