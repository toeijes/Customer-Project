const db = require('./db');

const projectCode = '1Z.64.1384.2.1.5.00.1';
const completedDate = '5/3/2564';

(async () => {
  try {
    await db.query(
      'UPDATE projects SET completed_date = ?, completion_year = 2564 WHERE project_code = ?',
      [completedDate, projectCode]
    );
    await db.query(
      'UPDATE plan_master SET completed_date = ? WHERE proj_no = ?',
      [completedDate, projectCode]
    );
    console.log(`Updated completion date for ${projectCode}`);
  } finally {
    const pool = db.getPool();
    if (pool) await pool.end();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
