const db = require('./db');
async function test() {
  try {
    const projectCode = '1Z.68.2405.2.1.5.00';
    const projects = await db.query('SELECT completion_year FROM projects WHERE project_code = ?', [projectCode]);
    const compYear = projects[0].completion_year;
    console.log('Project compYear:', compYear);
    
    const customers = await db.query(`SELECT c.custcode, c.custname, c.bgn_date, c.contrac_date, c.custstat, c.ba, b.branch_name FROM proj_cus pc JOIN customer c ON pc.custcode = c.custcode LEFT JOIN pwa_branches b ON c.ba = b.pwa_code WHERE pc.project_code = ? AND pc.is_used = 1`, [projectCode]);
    console.log('Linked customers:', customers.length);
    
    const early = customers.filter(c => {
      let bgnDate = null;
      if (c.bgn_date && c.bgn_date.length >= 6) {
        bgnDate = {
          year: parseInt(c.bgn_date.substring(0, 4)),
          month: parseInt(c.bgn_date.substring(4, 6))
        };
      }
      
      const compDateObj = { year: compYear, month: 1 };
      const isAfter = (dateObj, compObj) => {
        if (dateObj.year > compObj.year) return true;
        if (dateObj.year === compObj.year && dateObj.month > compObj.month) return true;
        return false;
      };
      
      if (!bgnDate) return false;
      const isEarly = !isAfter(bgnDate, compDateObj);
      return isEarly;
    });
    
    console.log('Early:', early.length);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
