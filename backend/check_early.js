const db = require('./db');

async function test() {
  const p = await db.query("SELECT * FROM projects WHERE completed_date IS NOT NULL");
  const m = await db.query("SELECT * FROM monthly_actual_users");

  const monthlyMap = {};
  m.forEach(row => {
    if(!monthlyMap[row.project_code]) monthlyMap[row.project_code] = [];
    monthlyMap[row.project_code].push(row);
  });

  const early = [];
  p.forEach(project => {
      let compAbsolute = null;
      const parts = project.completed_date.split('/');
      if (parts.length === 2) {
          compAbsolute = parseInt(parts[1], 10) * 12 + parseInt(parts[0], 10);
      } else if (parts.length === 3) {
          compAbsolute = parseInt(parts[2], 10) * 12 + parseInt(parts[1], 10);
      }
      
      const pMonthly = monthlyMap[project.project_code] || [];
      let found = false;
      pMonthly.forEach(row => {
          if (row.actual_users > 0) {
              const calYear = row.month_number >= 10 ? row.fiscal_year - 1 : row.fiscal_year;
              const currentAbsolute = calYear * 12 + row.month_number;
              if (currentAbsolute < compAbsolute) {
                  found = true;
              }
          }
      });
      if(found) early.push(project.project_code);
  });
  
  console.log("Projects with early customers:", early.length);
  if(early.length > 0) console.log(early.slice(0, 5));
  process.exit(0);
}
test();
