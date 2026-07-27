const db = require('./db');
async function run() {
  await db.initializeDatabase();
  const r = await db.query(`UPDATE projects p JOIN pwa_branches b ON TRIM(p.branch_name) = TRIM(REPLACE(REPLACE(b.branch_name, 'กปภ.สาขา', ''), ' (พ)', '')) SET p.pwa_code = b.pwa_code`);
  console.log(r);
}
run().finally(() => process.exit());
