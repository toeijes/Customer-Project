const db = require('./db');

async function run() {
  await db.initializeDatabase();

  console.log("Checking for Zone 7 actuals in proj_cus...");
  
  // Find some Zone 7 projects with contracts
  const p7 = await db.query(`
    SELECT p.project_code, p.contract_no, b.branch_name 
    FROM projects p
    LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE b.zone = 7 AND TRIM(p.contract_no) != ''
    LIMIT 10
  `);
  
  console.log("Sample Zone 7 projects:", p7);
  
  if (p7.length > 0) {
      const contract = p7[0].contract_no;
      const match = await db.query(`
        SELECT COUNT(*) as cnt 
        FROM proj_cus 
        WHERE TRIM(project_no_proj) = ? OR TRIM(project_no_pipe) = ?
      `, [contract.trim(), contract.trim()]);
      console.log(`Matches in proj_cus for ${contract}:`, match[0].cnt);
  }
  
  // Check how many proj_cus records might match ANY zone 7 project
  const allZ7Matches = await db.query(`
    SELECT COUNT(*) as cnt
    FROM proj_cus c
    JOIN projects p ON TRIM(c.project_no_proj) = TRIM(p.contract_no)
    LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE b.zone = 7
  `);
  console.log("Total matching proj_cus records for Zone 7 (by proj):", allZ7Matches[0].cnt);

  const allZ7MatchesPipe = await db.query(`
    SELECT COUNT(*) as cnt
    FROM proj_cus c
    JOIN projects p ON TRIM(c.project_no_pipe) = TRIM(p.contract_no)
    LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE b.zone = 7
  `);
  console.log("Total matching proj_cus records for Zone 7 (by pipe):", allZ7MatchesPipe[0].cnt);
  
  process.exit();
}
run();
