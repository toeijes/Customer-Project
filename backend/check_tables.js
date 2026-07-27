const db = require('./db');

async function test() {
  const [rows] = await db.query("SHOW TABLES");
  console.log(rows);
  process.exit(0);
}
test();
