const db = require('./db');

async function run() {
  await db.initializeDatabase();
  console.log("Fetching raw actuals for Zone 7...");

  const rawActuals = await db.query(`
      SELECT 
        c.custcode,
        p.project_code,
        c.yearinstall,
        c.contrac_date,
        c.bgncustdt,
        cust.BGN_DATE,
        p.completed_date,
        p.start_year AS proj_year
      FROM proj_cus c
      LEFT JOIN customer cust ON c.custcode = cust.cus_code
      JOIN projects p ON TRIM(c.project_no_proj) = TRIM(p.contract_no)
      LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code
      WHERE b.zone = 7
        AND (c.yearinstall IS NOT NULL OR cust.BGN_DATE IS NOT NULL OR c.bgncustdt IS NOT NULL)
        AND TRIM(p.contract_no) != ''
        AND TRIM(c.project_no_proj) != ''
        AND p.project_type IN (1, 2, 3, 4)
      LIMIT 10
  `);
  
  console.log("Raw actuals:", rawActuals);
  
  const countRaw = await db.query(`
      SELECT COUNT(*) as cnt
      FROM proj_cus c
      LEFT JOIN customer cust ON c.custcode = cust.cus_code
      JOIN projects p ON TRIM(c.project_no_proj) = TRIM(p.contract_no)
      LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code
      WHERE b.zone = 7
        AND (c.yearinstall IS NOT NULL OR cust.BGN_DATE IS NOT NULL OR c.bgncustdt IS NOT NULL)
        AND TRIM(p.contract_no) != ''
        AND TRIM(c.project_no_proj) != ''
        AND p.project_type IN (1, 2, 3, 4)
  `);
  console.log("Count of raw actuals for Zone 7:", countRaw[0].cnt);
  
  process.exit();
}
run();
