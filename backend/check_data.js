const db = require('./db');

async function test() {
  const res = await db.query("SELECT p.project_code, p.completed_date FROM projects p WHERE p.project_code = '1Z.64.1590.2.1.5.00.2'");
  console.log(res);
  process.exit(0);
}
test();
