const db = require('./db');

async function fix() {
  const tables = ['monthly_actual_users', 'project_usage_summary'];
  for (const t of tables) {
    try {
      await db.query(`ALTER TABLE ${t} MODIFY COLUMN project_name VARCHAR(1000)`);
      console.log('Fixed ' + t);
    } catch (e) {
      console.log('Skipped ' + t + ' - ' + e.message);
    }
  }
  process.exit();
}
fix();
