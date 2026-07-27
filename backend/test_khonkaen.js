const db = require('./db');
async function run() {
  const [d] = await db.query("SELECT m.fiscal_year, p.pwa_code, m.month_number, m.actual_users FROM monthly_actual_users m LEFT JOIN projects p ON m.project_code = p.project_code WHERE p.pwa_code = '5521011'");
  console.log(d.length, 'records for Khon Kaen', d[0]);
}
run().finally(() => process.exit());
