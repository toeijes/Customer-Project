const db = require('./db');

async function run() {
  try {
    const projects = await db.query("SELECT project_code, contract_no, project_name, completed_date, start_year, completion_year, project_type FROM projects WHERE project_code='111/2567'");
    console.log('Project Details:\n', projects[0]);

    const customers = await db.query(`
      SELECT 
        pc.custcode,
        c.BGN_DATE as raw_bgn_date,
        pc.bgncustdt,
        pc.yearinstall
      FROM proj_cus pc
      LEFT JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      JOIN projects p ON TRIM(p.contract_no) != '' AND (
        (pc.project_no_proj IS NOT NULL AND TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
        OR
        (pc.project_no_pipe IS NOT NULL AND TRIM(CONVERT(pc.project_no_pipe USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
      )
      WHERE p.project_code = '111/2567'
    `);
    
    console.log(`Total Customers for this contract: ${customers.length}`);

    // Helper functions from your code
    function parseCompletedDate(dateStr) {
      if (!dateStr) return null;
      const parts = dateStr.trim().split('/');
      if (parts.length !== 3) return null;
      return { year: parseInt(parts[2], 10), month: parseInt(parts[1], 10), day: parseInt(parts[0], 10) };
    }
    function parseBgncustdt(dateStr) {
      if (!dateStr || dateStr.length !== 6) return null;
      return { 
        year: parseInt(dateStr.substring(0, 2), 10) + 2500, 
        month: parseInt(dateStr.substring(2, 4), 10), 
        day: parseInt(dateStr.substring(4, 6), 10) 
      };
    }
    function parseBgnDate(dateVal) {
      if (!dateVal) return null;
      if (dateVal instanceof Date) {
        return { year: dateVal.getFullYear() + 543, month: dateVal.getMonth() + 1, day: dateVal.getDate() };
      }
      return null;
    }
    function isAfter(date1, date2) {
      if (!date1 || !date2) return false;
      if (date1.year !== date2.year) return date1.year > date2.year;
      if (date1.month !== date2.month) return date1.month > date2.month;
      return date1.day > date2.day;
    }

    if(projects[0]) {
      const p = projects[0];
      let compDate = parseCompletedDate(p.completed_date);
      console.log('Parsed Completion Date:', compDate);

      let eligibleCount = 0;
      let nonEligibleCount = 0;
      let breakdown = { beforeCompDate: 0, wrongYear: 0, noDate: 0 };

      for(let c of customers) {
        let bgnDate = parseBgnDate(c.raw_bgn_date) || parseBgncustdt(c.bgncustdt);
        
        if (!bgnDate || !compDate || !isAfter(bgnDate, compDate)) {
          if (!bgnDate) breakdown.noDate++;
          else breakdown.beforeCompDate++;
          nonEligibleCount++;
          continue;
        }
        
        const year = parseInt(c.yearinstall || 0);
        if(p.project_type === 4 && year !== p.completion_year) {
          breakdown.wrongYear++;
          nonEligibleCount++;
          continue;
        } else if (p.project_type !== 4 && year < p.completion_year) {
          breakdown.wrongYear++;
          nonEligibleCount++;
          continue;
        }

        eligibleCount++;
      }

      console.log(`Eligible KPI Customers: ${eligibleCount}`);
      console.log(`Non-Eligible Customers: ${nonEligibleCount} (Breakdown: Before Comp Date = ${breakdown.beforeCompDate}, Wrong Year = ${breakdown.wrongYear}, No Date = ${breakdown.noDate})`);
      
      console.log('Sample of First 5 Non-Eligible (Before Comp Date):', customers.filter(c => {
        let bgnDate = parseBgnDate(c.raw_bgn_date) || parseBgncustdt(c.bgncustdt);
        return bgnDate && compDate && !isAfter(bgnDate, compDate);
      }).slice(0, 5).map(c => ({
        custcode: c.custcode,
        bgn_date_parsed: parseBgnDate(c.raw_bgn_date) || parseBgncustdt(c.bgncustdt)
      })));
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
