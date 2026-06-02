require('dotenv').config();
const db = require('./db');


async function test() {
  try {
    await db.initializeDatabase();
    
    // 1. Get some projects
    const projects = await db.query('SELECT project_code, contract_no FROM projects LIMIT 5;');
    console.log('Sample projects:', projects);
    
    if (projects.length === 0) {
      console.log('No projects in database!');
      process.exit(0);
    }
    
    // 2. Query customers for the first project code
    const project_code = projects[0].project_code;
    console.log(`Querying customers for project: ${project_code}`);
    
    const customers = await db.query(`
      SELECT 
        pc.custcode AS cus_code, 
        COALESCE(c.fullName, 'ไม่พบรายชื่อในฐานข้อมูล') AS fullName, 
        c.LATITUDE, 
        c.LONGITUDE, 
        COALESCE(c.full_address, 'ไม่พบที่อยู่ในฐานข้อมูล') AS full_address,
        COALESCE(c.meter_no, pc.meterno) AS meter_no,
        COALESCE(c.use_Name, '-') AS use_Name,
        COALESCE(c.brandName, '-') AS brandName,
        COALESCE(c.sizeName, '-') AS sizeName,
        COALESCE(c.present_meter_count, 0) AS present_meter_count,
        COALESCE(c.status, '-') AS status,
        pc.bgncustdt,
        DATE_FORMAT(DATE_ADD(c.BGN_DATE, INTERVAL 543 YEAR), '%e/%c/%Y') AS bgn_date_formatted
      FROM proj_cus pc
      LEFT JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      JOIN projects p ON TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no)
      WHERE p.project_code = ?
        AND TRIM(p.contract_no) != ''
        AND TRIM(pc.project_no_proj) != '';
    `, [project_code]);
    
    console.log('Customers count:', customers.length);
    if (customers.length > 0) {
      console.log('Sample customer:', customers[0]);
    }
    
    // 3. Check raw proj_cus matches for the contract_no
    const contract_no = projects[0].contract_no;
    console.log(`Checking raw proj_cus matching contract_no: "${contract_no}"`);
    const rawMatches = await db.query(
      'SELECT COUNT(*) as count FROM proj_cus WHERE TRIM(project_no_proj) = ?;',
      [contract_no.trim()]
    );
    console.log('Raw proj_cus matches:', rawMatches[0].count);
    
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

test();
