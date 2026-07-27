const db = require('./db');

async function main() {
  try {
    const projects = await db.query(`
      SELECT p.*, b.ba 
      FROM projects p
      LEFT JOIN pwa_branches b ON p.branch_name = b.branch_name
      WHERE p.project_code NOT LIKE 'PWA6-%' AND p.project_type IN (1, 2, 3, 4);
    `);
    
    const actuals = await db.query(`
      SELECT project_code, SUM(actual_users) as total_actual_users 
      FROM project_yearly_performance 
      WHERE project_code NOT LIKE 'PWA6-%'
      GROUP BY project_code;
    `);

    const actualsMap = {};
    actuals.forEach(act => {
      actualsMap[act.project_code] = parseInt(act.total_actual_users || 0);
    });

    let totalActual = 0;
    projects.forEach(p => {
      totalActual += actualsMap[p.project_code] || 0;
    });

    console.log('Total Actual Users on Local DB:', totalActual);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
main();
