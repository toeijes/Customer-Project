const db = require('./db');
async function run() {
  const r = await db.query("SELECT * FROM pwa_branches WHERE branch_name LIKE '%เขต%'");
  console.log(r);
}
run().finally(() => process.exit());
