const db = require('./db');
async function run() {
  await db.initializeDatabase();
  
  // check projects in zone 7
  const z7 = await db.query(`
    SELECT p.project_code, p.pwa_code, b.branch_name, b.zone 
    FROM projects p
    LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE b.zone = 7
  `);
  console.log("Zone 7 projects count:", z7.length);
  
  const z7WithActuals = await db.query(`
    SELECT p.project_code, p.pwa_code, b.branch_name, SUM(y.actual_users) as total
    FROM projects p
    JOIN project_yearly_performance y ON p.project_code = y.project_code
    LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE b.zone = 7
    GROUP BY p.project_code
  `);
  console.log("Zone 7 projects with actuals in performance table:", z7WithActuals.length);
  
  process.exit();
}
run();
