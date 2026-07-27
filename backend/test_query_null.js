const db = require('./db');
async function run() {
  const r = await db.query('SELECT count(*) as c FROM pwa_branches WHERE branch_name IS NULL');
  console.log(r);
}
run().finally(() => process.exit());
