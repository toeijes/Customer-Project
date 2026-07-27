const db = require('./db');
async function run() {
  await db.query("UPDATE pwa_branches SET branch_name = TRIM(REPLACE(branch_name, 'กปภ.สาขา', '')) WHERE branch_name LIKE 'กปภ.สาขา%'");
  const r = await db.query("SELECT branch_name FROM pwa_branches LIMIT 5");
  console.log(r);
}
run().finally(() => process.exit());
