const db = require('./db');
async function run() {
  const r = await db.query("SELECT branch_name FROM project_monthly_usage LIMIT 5");
  console.log(JSON.stringify(r));
}
run().finally(() => process.exit());
