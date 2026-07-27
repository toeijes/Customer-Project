const db = require('./db');

async function check() {
  await db.initializeDatabase();
  const q1 = await db.query(`SELECT SUM(actual_users) as total FROM project_yearly_performance WHERE project_code NOT LIKE 'PWA6-%'`);
  console.log("Total in yearly performance:", q1[0].total);

  const q2 = await db.query(`
    SELECT SUM(y.actual_users) as total 
    FROM project_yearly_performance y
    JOIN projects p ON y.project_code = p.project_code
    WHERE y.project_code NOT LIKE 'PWA6-%' 
    AND p.project_type IN (1, 2, 3, 4)
  `);
  console.log("Total for valid project types:", q2[0].total);

  const q3 = await db.query(`
    SELECT p.project_type, SUM(y.actual_users) as total
    FROM project_yearly_performance y
    JOIN projects p ON y.project_code = p.project_code
    WHERE y.project_code NOT LIKE 'PWA6-%'
    GROUP BY p.project_type
  `);
  console.log("By type:", q3);

  process.exit(0);
}

check();
