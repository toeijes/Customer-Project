const db = require('./db');
async function run() {
  const p = await db.query(`
    SELECT sum(py.actual_users) as sum 
    FROM project_yearly_performance py 
    JOIN projects p ON py.project_code = p.project_code 
    JOIN pwa_branches b ON p.pwa_code = b.pwa_code 
    WHERE b.zone = 6
  `);
  console.log('Including PWA6-:', p[0].sum);
}
run().catch(console.error).finally(() => process.exit());
