const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/backend/server.js';
let code = fs.readFileSync(path, 'utf8');

// I will overwrite the entire endpoint block
const oldEndpointStart = code.indexOf('// NEW ENDPOINT: Early Customers Details');
if (oldEndpointStart === -1) {
  console.log('Could not find endpoint');
  process.exit(1);
}
const oldEndpointEnd = code.indexOf('    app.listen(PORT, () => {', oldEndpointStart);
const before = code.substring(0, oldEndpointStart);
const after = code.substring(oldEndpointEnd);

const newEndpoint = `// ==========================================
// NEW ENDPOINT: Early Customers Details
// ==========================================

function parseCompletedDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return { year: y, month: m, day: d };
}

function parseBgncustdt(dateStr) {
  if (!dateStr || dateStr.length !== 6) return null;
  const y = parseInt(dateStr.substring(0, 2), 10) + 2500;
  const m = parseInt(dateStr.substring(2, 4), 10);
  const d = parseInt(dateStr.substring(4, 6), 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { year: y, month: m, day: d };
}

function parseBgnDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return {
      year: dateVal.getFullYear() + 543,
      month: dateVal.getMonth() + 1,
      day: dateVal.getDate()
    };
  }
  if (typeof dateVal === 'string') {
    const parts = dateVal.trim().split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { year: y + 543, month: m, day: d };
      }
    }
  }
  return null;
}

function isAfter(date1, date2) {
  if (date1.year !== date2.year) return date1.year > date2.year;
  if (date1.month !== date2.month) return date1.month > date2.month;
  return date1.day > date2.day;
}

app.get('/api/projects/:code/early-customers', async (req, res) => {
  try {
    const projectCode = req.params.code;
    
    // Get project completion date
    const projects = await db.query(
      'SELECT completion_year, completed_date, start_year FROM projects WHERE project_code = ?',
      [projectCode]
    );
    
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const pInfo = projects[0];
    let compDate = parseCompletedDate(pInfo.completed_date);
    if (!compDate && pInfo.start_year) {
      // Fallback to start of fiscal year: Oct 1st of (proj_year - 1)
      compDate = { year: pInfo.start_year - 1, month: 10, day: 1 };
    }
    if (!compDate) {
       // Just fallback to Jan 1st of completion_year if everything else fails
       compDate = { year: pInfo.completion_year, month: 1, day: 1 };
    }
    
    // Get all customers linked to this project using both project_no_proj and project_no_pipe
    const customers = await db.query(
      \`SELECT 
          cust.cus_code as custcode, 
          cust.fullName as custname, 
          cust.BGN_DATE, 
          pc.bgncustdt,
          pc.contrac_date, 
          cust.status as custstat, 
          pc.pwa_code as ba, 
          b.branch_name
       FROM proj_cus pc
       JOIN projects p ON (TRIM(pc.project_no_proj) = TRIM(p.contract_no) OR TRIM(pc.project_no_pipe) = TRIM(p.contract_no))
       LEFT JOIN customer cust ON pc.custcode = cust.cus_code
       LEFT JOIN pwa_branches b ON pc.pwa_code = b.pwa_code
       WHERE p.project_code = ? AND pc.is_used = 1\`,
      [projectCode]
    );
    
    const earlyCustomers = [];
    
    for (const c of customers) {
      let bgnDate = parseBgnDate(c.BGN_DATE);
      if (!bgnDate) {
        bgnDate = parseBgncustdt(c.bgncustdt);
      }
      
      if (!bgnDate) continue;
      
      const isEarly = !isAfter(bgnDate, compDate);
      if (isEarly) {
        c.bgn_date = c.BGN_DATE || c.bgncustdt; // Frontend uses bgn_date
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

fs.writeFileSync(path, before + newEndpoint + '\n' + after);
console.log('Fixed API successfully');
