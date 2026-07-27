const db = require('./db');
async function run() {
  const r1 = await db.query("SELECT COUNT(*) as c FROM projects WHERE branch_name LIKE 'กปภ.สาขา%'");
  const r2 = await db.query("SELECT COUNT(*) as c FROM projects WHERE branch_name NOT LIKE 'กปภ.สาขา%'");
  console.log('Projects With prefix:', r1[0].c, 'Without prefix:', r2[0].c);
}
run().finally(() => process.exit());
