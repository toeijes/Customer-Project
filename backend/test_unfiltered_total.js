const db = require('./db');

async function run() {
  const oldTotal = await db.query(`
    SELECT SUM(actual_users) as old_total 
    FROM monthly_actual_users m 
    JOIN pwa_branches b ON REPLACE(m.branch_name, 'กปภ.สาขา', '') = REPLACE(b.branch_name, 'กปภ.สาขา', '') 
    WHERE b.zone = 6
  `);
  console.log('Without filter:', oldTotal[0].old_total);
}
run().finally(() => process.exit());
