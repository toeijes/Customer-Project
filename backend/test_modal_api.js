const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    const project_code = '1Z.67.1560.2.1.5.00';
    const [project] = await db.query('SELECT contract_no, project_name, completed_date, start_year, project_type, completion_year FROM projects WHERE project_code = ?;', [project_code]);
    
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
        pc.yearinstall,
        c.BGN_DATE AS raw_bgn_date,
        DATE_FORMAT(DATE_ADD(c.BGN_DATE, INTERVAL 543 YEAR), '%e/%c/%Y') AS bgn_date_formatted
      FROM proj_cus pc
      LEFT JOIN customer c ON pc.custcode = c.cus_code
      JOIN projects p ON p.contract_no != '' AND (
        (pc.project_no_proj IS NOT NULL AND pc.project_no_proj = p.contract_no)
        OR
        (pc.project_no_pipe IS NOT NULL AND pc.project_no_pipe = p.contract_no)
      )
      WHERE p.project_code = ?;
    `, [project_code]);

    console.log(`Raw customers length from query: ${customers.length}`);
    
    // Print out the details of customers
    customers.forEach((c, index) => {
      console.log(`[${index+1}] cus_code: ${c.cus_code}, bgncustdt: ${c.bgncustdt}, raw_bgn_date: ${c.raw_bgn_date}, bgn_date_formatted: ${c.bgn_date_formatted}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
