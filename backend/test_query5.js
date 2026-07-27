const db = require('./db');
async function test() {
  try {
    const res = await db.query("SELECT c.custcode, p.project_code, c.project_no_proj, p.contract_no FROM proj_cus c JOIN projects p ON TRIM(c.project_no_proj) = TRIM(p.contract_no) WHERE p.project_code = '1Z.68.2405.2.1.5.00'");
    console.log('Found:', res.length);
    if (res.length > 0) console.log(res[0]);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
