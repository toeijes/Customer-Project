const db = require('./db');

async function check() {
  const p = await db.query("SELECT * FROM projects WHERE project_code = '1Z.68.3590.2.1.5.00'");
  console.log("Project:", p);
  const m = await db.query("SELECT * FROM monthly_actual_users WHERE project_code = '1Z.68.3590.2.1.5.00'");
  console.log("Monthly:", m);
  process.exit(0);
}
check();
