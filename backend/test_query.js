const db = require('./db');
async function test() {
  try {
    const projectCode = '1Z.68.2405.2.1.5.00';
    const projects = await db.query('SELECT completion_year FROM projects WHERE project_code = ?', [projectCode]);
    
    if (projects.length === 0) return console.log('No project');
    
    const compYear = projects[0].completion_year;
    const compMonth = 1;
    console.log({compYear, compMonth});
    
    const customers = await db.query(`SELECT c.custcode, c.custname, c.bgn_date, c.contrac_date, c.custstat, c.ba, b.branch_name FROM proj_cus pc JOIN customer c ON pc.custcode = c.custcode LEFT JOIN branch b ON c.ba = b.pwa_code WHERE pc.project_code = ? AND pc.is_used = 1`, [projectCode]);
    console.log('Customers linked:', customers.length);
    
    const earlyCustomers = [];
    for (const c of customers) {
      let bgnDate = null;
      if (c.bgn_date && c.bgn_date.length >= 6) {
        bgnDate = {
          year: parseInt(c.bgn_date.substring(0, 4)),
          month: parseInt(c.bgn_date.substring(4, 6))
        };
      } else if (c.contrac_date && c.contrac_date.length >= 4) {
        // Fallback to contrac_date like in update_data.js?
        // Let's check update_data.js.
      }
      
      const compDateObj = { year: compYear, month: compMonth };
      const isAfter = (dateObj, compObj) => {
        if (dateObj.year > compObj.year) return true;
        if (dateObj.year === compObj.year && dateObj.month > compObj.month) return true;
        return false;
      };
      
      if (!bgnDate) continue;
      
      const isEarly = !isAfter(bgnDate, compDateObj);
      if (isEarly) earlyCustomers.push(c);
    }
    
    console.log('Early Customers:', earlyCustomers.length);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
