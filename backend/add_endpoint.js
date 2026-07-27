const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/backend/server.js';
let code = fs.readFileSync(path, 'utf8');

const newEndpoint = `
// ==========================================
// NEW ENDPOINT: Early Customers Details
// ==========================================
app.get('/api/projects/:code/early-customers', async (req, res) => {
  try {
    const projectCode = req.params.code;
    
    // Get project completion date
    const [projects] = await db.query(
      'SELECT completion_date FROM projects WHERE project_code = ?',
      [projectCode]
    );
    
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const compDateStr = projects[0].completion_date;
    if (!compDateStr || compDateStr.length !== 6) {
      return res.json([]);
    }
    
    const compYear = parseInt(compDateStr.substring(0, 4));
    const compMonth = parseInt(compDateStr.substring(4, 6));
    
    // Get all customers linked to this project
    const [customers] = await db.query(
      \`SELECT c.custcode, c.custname, c.bgn_date, c.contrac_date, c.custstat, c.ba, b.branch_name
       FROM proj_cus pc
       JOIN customer c ON pc.custcode = c.custcode
       LEFT JOIN branch b ON c.ba = b.pwa_code
       WHERE pc.project_code = ? AND pc.is_used = 1\`,
      [projectCode]
    );
    
    const earlyCustomers = [];
    
    for (const c of customers) {
      let bgnDate = null;
      if (c.bgn_date && c.bgn_date.length >= 6) {
        bgnDate = {
          year: parseInt(c.bgn_date.substring(0, 4)),
          month: parseInt(c.bgn_date.substring(4, 6))
        };
      }
      
      const compDateObj = { year: compYear, month: compMonth };
      
      const isAfter = (dateObj, compObj) => {
        if (dateObj.year > compObj.year) return true;
        if (dateObj.year === compObj.year && dateObj.month > compObj.month) return true;
        return false;
      };
      
      if (!bgnDate) continue;
      const isEarly = !isAfter(bgnDate, compDateObj);
      
      if (isEarly) {
        earlyCustomers.push(c);
      }
    }
    
    res.json(earlyCustomers);
  } catch (error) {
    console.error('Error fetching early customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
`;

code = code.replace('    app.listen(PORT, () => {', newEndpoint + '\n    app.listen(PORT, () => {');

fs.writeFileSync(path, code);
console.log('Appended endpoint successfully.');
