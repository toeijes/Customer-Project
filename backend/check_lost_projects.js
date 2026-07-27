const db = require('./db');

async function run() {
  const projects = await db.query(`
    SELECT p.project_code, p.branch_name, p.pwa_code, py.total 
    FROM projects p 
    LEFT JOIN (
      SELECT project_code, sum(actual_users) as total 
      FROM project_yearly_performance 
      GROUP BY project_code
    ) py ON p.project_code = py.project_code 
    WHERE REPLACE(p.branch_name, 'กปภ.สาขา', '') IN (
      SELECT REPLACE(branch_name, 'กปภ.สาขา', '') FROM pwa_branches WHERE zone = 6
    ) 
    AND (p.pwa_code IS NULL OR p.pwa_code NOT IN (SELECT pwa_code FROM pwa_branches WHERE zone = 6))
  `);
  
  console.log('Mismatched projects:', projects.length);
  let sum = 0;
  projects.forEach(p => {
    sum += p.total || 0;
  });
  console.log('Lost total_actual_users:', sum);
  console.log(projects.slice(0, 5));
}

run().catch(console.error).finally(() => process.exit());
