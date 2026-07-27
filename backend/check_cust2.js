const db = require('./db');

async function check() {
  const c = await db.query("SELECT * FROM customer WHERE cus_code = '10601150132'");
  console.log("Customer:", c);
  const pc = await db.query("SELECT * FROM proj_cus WHERE cus_code = '10601150132'");
  console.log("ProjCus:", pc);
  process.exit(0);
}
check();
