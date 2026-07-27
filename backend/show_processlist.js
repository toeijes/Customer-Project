const db = require('./db');
async function run() {
  try {
    await db.initializeDatabase();
    const rows = await db.query('SHOW FULL PROCESSLIST');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
