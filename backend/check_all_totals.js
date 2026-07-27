const db = require('./db');
async function run() {
  const py = await db.query(`SELECT sum(actual_users) as sum FROM project_yearly_performance`);
  const m = await db.query(`SELECT sum(actual_users) as sum FROM monthly_actual_users`);
  console.log('Total project_yearly_performance:', py[0].sum);
  console.log('Total monthly_actual_users:', m[0].sum);
}
run().catch(console.error).finally(() => process.exit());
