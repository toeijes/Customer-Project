const db = require('./db');
async function run() {
  const result = await db.query(`
    SELECT sum(py.actual_users) as total
    FROM project_yearly_performance py
    JOIN projects p ON py.project_code = p.project_code
    JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE b.zone = 6 AND py.project_code NOT LIKE 'PWA6-%' AND p.project_type IN (1, 2, 3, 4)
  `);
  console.log('Total in project_yearly_performance for Zone 6:', result[0].total);
}
run().catch(console.error).finally(() => process.exit());
