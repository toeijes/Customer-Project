const db = require('./db');
async function test() {
  try {
    const res = await db.query("SELECT * FROM proj_cus WHERE TRIM(project_no_proj) = '0'");
    console.log('Found proj_cus with 0:', res.length);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
