const db = require('./db');

async function main() {
  try {
    const rawProjects = await db.query(`
      SELECT p.*, b.ba 
      FROM projects p
      LEFT JOIN pwa_branches b ON p.branch_name = b.branch_name
      WHERE p.project_code NOT LIKE 'PWA6-%' AND p.project_type IN (1, 2, 3, 4);
    `);

    // Let's load actual registrations from proj_cus
    const customers = await db.query(`
      SELECT 
        pc.project_no_proj,
        pc.project_no_pipe,
        pc.yearinstall,
        COUNT(pc.id) as actual_users
      FROM proj_cus pc
      GROUP BY pc.project_no_proj, pc.project_no_pipe, pc.yearinstall;
    `);

    const projectsMap = {};
    rawProjects.forEach(p => {
      projectsMap[p.project_code] = p;
    });

    const projectActuals = {};
    customers.forEach(row => {
      // Find matching project
      const proj = rawProjects.find(p => 
        (row.project_no_proj && p.contract_no === row.project_no_proj) ||
        (row.project_no_pipe && p.contract_no === row.project_no_pipe)
      );
      if (!proj) return;

      const code = proj.project_code;
      if (!projectActuals[code]) {
        projectActuals[code] = {};
      }
      const year = parseInt(row.yearinstall || 0);
      if (year > 0) {
        projectActuals[code][year] = (projectActuals[code][year] || 0) + row.actual_users;
      }
    });

    // Helper functions
    function getActualForYear(code, year) {
      if (!projectActuals[code] || !projectActuals[code][year]) return 0;
      return projectActuals[code][year];
    }

    function getActualForYear5PlusOld(code, completionYear) {
      if (!projectActuals[code]) return 0;
      let total = 0;
      for (const yearStr in projectActuals[code]) {
        const year = parseInt(yearStr);
        if (year >= completionYear + 5) {
          total += projectActuals[code][year];
        }
      }
      return total;
    }

    function getActualForYear5PlusNew(code, completionYear) {
      if (!projectActuals[code]) return 0;
      let total = 0;
      for (const yearStr in projectActuals[code]) {
        const year = parseInt(yearStr);
        if (year === completionYear + 5) {
          total += projectActuals[code][year];
        }
      }
      return total;
    }

    let totalOld = 0;
    let totalNew = 0;

    rawProjects.forEach(p => {
      const code = p.project_code;
      const type = p.project_type;
      const compYear = p.completion_year;

      if (type === 4) {
        const act = getActualForYear(code, compYear);
        totalOld += act;
        totalNew += act;
      } else {
        for (let i = 0; i <= 5; i++) {
          const currentYear = compYear + i;
          if (i === 5) {
            totalOld += getActualForYear5PlusOld(code, compYear);
            totalNew += getActualForYear5PlusNew(code, compYear);
          } else {
            const act = getActualForYear(code, currentYear);
            totalOld += act;
            totalNew += act;
          }
        }
      }
    });

    console.log('Total Actual Users (Old Logic):', totalOld);
    console.log('Total Actual Users (New Logic):', totalNew);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
main();
