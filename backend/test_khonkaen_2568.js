const db = require('./db');
async function run() {
  const d = await db.query("SELECT COUNT(*) as c FROM monthly_actual_users m LEFT JOIN projects p ON m.project_code = p.project_code WHERE p.pwa_code = '5521011' AND m.fiscal_year = 2568");
  console.log('Count:', d[0].c);
}
run().finally(() => process.exit());
