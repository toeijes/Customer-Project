const db = require('./db');

async function test() {
  const col = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'customer'");
  console.log("Result:", col);
  process.exit(0);
}
test();
