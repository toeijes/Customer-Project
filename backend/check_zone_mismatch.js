const db = require('./db');

async function run() {
  const projects = await db.query(`
    SELECT p.project_code, p.branch_name, p.pwa_code, b.zone as new_zone, py.total 
    FROM projects p 
    LEFT JOIN (
      SELECT project_code, sum(actual_users) as total 
      FROM project_yearly_performance 
      GROUP BY project_code
    ) py ON p.project_code = py.project_code 
    LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code 
    WHERE (
      REPLACE(p.branch_name, 'กปภ.สาขา', '') IN (SELECT REPLACE(branch_name, 'กปภ.สาขา', '') FROM pwa_branches WHERE zone = 6) 
      AND (b.zone != 6 OR b.zone IS NULL)
    ) 
    OR (
      REPLACE(p.branch_name, 'กปภ.สาขา', '') NOT IN (SELECT REPLACE(branch_name, 'กปภ.สาขา', '') FROM pwa_branches WHERE zone = 6) 
      AND b.zone = 6
    )
  `);
  console.log('Mismatched projects:', projects.length);
  projects.forEach(p => console.log(p));
}

run().catch(console.error).finally(() => process.exit());
