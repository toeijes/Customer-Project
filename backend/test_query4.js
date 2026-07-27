const db = require('./db');
async function test() {
  try {
    const customers = await db.query(`SELECT c.custcode, p.project_code, cust.fullName, cust.BGN_DATE, c.contrac_date, cust.status, c.pwa_code FROM proj_cus c LEFT JOIN customer cust ON c.custcode = cust.cus_code JOIN projects p ON TRIM(c.project_no_proj) = TRIM(p.contract_no) WHERE p.project_code = '1Z.68.2405.2.1.5.00'`);
    console.log('Found:', customers.length);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
