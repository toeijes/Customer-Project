const db = require('./db');
async function run() {
  const r = await db.query(`
    SELECT COUNT(*) as c 
    FROM monthly_actual_users m
    JOIN projects p ON m.project_code = p.project_code
    JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE b.zone = 7
  `);
  console.log('Monthly records for Zone 7:', r[0].c);
}
run().finally(() => process.exit());
