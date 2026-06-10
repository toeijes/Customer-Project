const db = require('./db');

async function test() {
  try {
    await db.initializeDatabase();
    
    // Find project
    const projects = await db.query("SELECT * FROM projects WHERE contract_no LIKE '%178/2568%'");
    console.log('Projects found:', projects);
    
    if (projects.length === 0) {
      console.log('No project found with contract_no like 178/2568');
      process.exit(0);
    }
    
    const projCode = projects[0].project_code;
    
    // Check proj_cus entries
    const projCus = await db.query(`
      SELECT pc.custcode, pc.project_no_proj, pc.meterno
      FROM proj_cus pc
      JOIN projects p ON TRIM(p.contract_no) != '' AND (
        (pc.project_no_proj IS NOT NULL AND TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
        OR
        (pc.project_no_pipe IS NOT NULL AND TRIM(CONVERT(pc.project_no_pipe USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
      )
      WHERE p.project_code = ?
      LIMIT 10;
    `, [projCode]);
    console.log('Sample proj_cus entries for this project:', projCus);
    
    if (projCus.length > 0) {
      const sampleCustCodes = projCus.map(pc => pc.custcode);
      console.log('Sample custcodes to look up:', sampleCustCodes);
      
      // Look up these custcodes in customer table directly
      const customers = await db.query(`
        SELECT cus_code, fullName FROM customer WHERE cus_code IN (?)
      `, [sampleCustCodes]);
      console.log('Direct lookups in customer table:', customers);

      // Check if there are similar custcodes in customer table
      const firstCode = sampleCustCodes[0];
      const partialCode = firstCode ? firstCode.substring(0, 5) : '';
      const similar = await db.query(`
        SELECT cus_code, fullName FROM customer WHERE cus_code LIKE ? LIMIT 5
      `, [`%${partialCode}%`]);
      console.log(`Similar customer codes matching "${partialCode}":`, similar);
      
      // Let's count total mismatched
      const mismatchCount = await db.query(`
        SELECT COUNT(*) as count
        FROM proj_cus pc
        JOIN projects p ON TRIM(p.contract_no) != '' AND (
          (pc.project_no_proj IS NOT NULL AND TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
          OR
          (pc.project_no_pipe IS NOT NULL AND TRIM(CONVERT(pc.project_no_pipe USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
        )
        LEFT JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
        WHERE p.project_code = ? AND c.cus_code IS NULL;
      `, [projCode]);
      console.log('Mismatched count:', mismatchCount[0].count);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
