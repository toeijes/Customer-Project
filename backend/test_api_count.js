const db = require('./db');
async function run() {
  const [d] = await db.query("SELECT count(*) as c FROM monthly_actual_users m LEFT JOIN projects p ON m.project_code = p.project_code WHERE m.project_code NOT LIKE 'PWA6-%' AND m.project_type IN (1, 2, 3, 4)");
  console.log('Count:', d[0].c);
}
run().finally(() => process.exit());
