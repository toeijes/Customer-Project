const db = require('./db');

async function check() {
  const pc = await db.query("SELECT * FROM proj_cus WHERE custcode = '10601150132'");
  console.log("proj_cus data:", pc);
  process.exit(0);
}
check();
