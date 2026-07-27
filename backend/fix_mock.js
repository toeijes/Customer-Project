const db = require('./db');

async function fixData() {
  try {
    await db.query(`
      INSERT INTO monthly_actual_users 
      (project_code, project_name, branch_name, project_type, fiscal_year, month_number, month_name, actual_users)
      VALUES 
      ('1Z.68.3590.2.1.5.00', 'งานวางท่อขยายเขตจำหน่ายน้ำ (วางท่อเข้าซอย) บ้านงิ้ว หมู่ 19 ตำบลสาวะถี อำเภอเมืองขอนแก่น จังหวัดขอนแก่น', 'ขอนแก่น', 4, 2563, 5, 'พ.ค.', 1)
    `);
    console.log("Inserted mock data for May 2563");
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
fixData();
