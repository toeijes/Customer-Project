const db = require('./db');

const SCHEMA_DDL = [
  // 1. ตารางสาขา
  `CREATE TABLE IF NOT EXISTS pwa_branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL UNIQUE,
    province VARCHAR(100) NOT NULL,
    ba VARCHAR(10) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 2. ตารางโครงการ
  `CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_code VARCHAR(50) NOT NULL UNIQUE,
    contract_no VARCHAR(100) NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    pwa_code VARCHAR(20) NULL,
    project_name VARCHAR(255) NOT NULL,
    project_type TINYINT NOT NULL COMMENT '1=เงินรายได้, 2=เงินอุดหนุน, 3=กระตุ้นเศรษฐกิจ, 4=วางท่อเข้าซอย',
    start_year INT NOT NULL,
    completion_year INT NOT NULL,
    completed_date VARCHAR(100) NULL,
    budget DECIMAL(15, 2) NOT NULL,
    target_users INT NOT NULL,
    remarks VARCHAR(500) NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 3. ตารางข้อมูลผู้ใช้รายเดือน
  `CREATE TABLE IF NOT EXISTS monthly_actual_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_code VARCHAR(50) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    project_type TINYINT NOT NULL,
    fiscal_year INT NOT NULL,
    month_number TINYINT NOT NULL,
    month_name VARCHAR(20) NOT NULL,
    actual_users INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_project_year_month (project_code, fiscal_year, month_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 4. ตารางเป้าหมายและการคำนวณจุดคุ้มทุนสะสมรายปี
  `CREATE TABLE IF NOT EXISTS project_yearly_performance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_code VARCHAR(50) NOT NULL,
    fiscal_year INT NOT NULL,
    year_type VARCHAR(20) NOT NULL COMMENT 'completion_year, year_1, year_2, year_3, year_4, year_5_plus',
    target_percentage DECIMAL(5, 2) NOT NULL,
    target_users INT NOT NULL,
    actual_users INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_project_fiscal_year (project_code, fiscal_year)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 5. ตารางรายชื่อผู้ใช้น้ำที่อยู่ในเงื่อนไข
  `CREATE TABLE IF NOT EXISTS eligible_customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_code VARCHAR(50) NOT NULL,
    custcode VARCHAR(50) NOT NULL,
    fiscal_year INT NOT NULL,
    month_number TINYINT NOT NULL,
    UNIQUE KEY uq_project_custcode (project_code, custcode),
    INDEX idx_custcode (custcode),
    INDEX idx_project_code (project_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
];


const MOCK_BRANCHES = [
  { name: 'ขอนแก่น', province: 'ขอนแก่น' },
  { name: 'บ้านไผ่', province: 'ขอนแก่น' },
  { name: 'ชุมแพ', province: 'ขอนแก่น' },
  { name: 'เลย', province: 'เลย' },
  { name: 'ชัยภูมิ', province: 'ชัยภูมิ' },
  { name: 'กาฬสินธุ์', province: 'กาฬสินธุ์' },
  { name: 'มหาสารคาม', province: 'มหาสารคาม' },
  { name: 'ร้อยเอ็ด', province: 'ร้อยเอ็ด' }
];

const MOCK_PROJECTS = [
  {
    project_code: 'PWA6-64-001',
    contract_no: 'กปภ.ข.6-01/2564',
    branch_name: 'ขอนแก่น',
    project_name: 'โครงการขยายเขตจำหน่ายน้ำบริการประชาชน ต.ศิลา อ.เมืองขอนแก่น',
    project_type: 1,
    start_year: 2564,
    completion_year: 2564,
    budget: 4500000.00,
    target_users: 100,
    yearly_actuals: { 2564: 30, 2565: 15, 2566: 20, 2567: 15, 2568: 15, 2569: 10 }
  },
  {
    project_code: 'PWA6-64-002',
    contract_no: 'กปภ.ข.6-05/2564',
    branch_name: 'มหาสารคาม',
    project_name: 'โครงการขยายเขตจำหน่ายน้ำบ้านดอนยม ต.เกิ้ง อ.เมืองมหาสารคาม',
    project_type: 2,
    start_year: 2564,
    completion_year: 2564,
    budget: 2800000.00,
    target_users: 80,
    yearly_actuals: { 2564: 35, 2565: 10, 2566: 12, 2567: 11, 2568: 10, 2569: 5 }
  },
  {
    project_code: 'PWA6-65-012',
    contract_no: 'สส.ข.6-08/2565',
    branch_name: 'ชัยภูมิ',
    project_name: 'โครงการเพิ่มขยายเขตจำหน่ายน้ำเพื่อฟื้นฟูเศรษฐกิจ ต.ในเมือง อ.เมืองชัยภูมิ',
    project_type: 3,
    start_year: 2565,
    completion_year: 2565,
    budget: 5200000.00,
    target_users: 150,
    yearly_actuals: { 2565: 55, 2566: 25, 2567: 20, 2568: 25, 2569: 30 }
  },
  {
    project_code: 'PWA6-64-004',
    contract_no: 'สญ.วท-44/2564',
    branch_name: 'บ้านไผ่',
    project_name: 'โครงการวางท่อเข้าซอยพัฒนาสุข ถ.เจนจดิศ บ้านไผ่',
    project_type: 4,
    start_year: 2564,
    completion_year: 2564,
    budget: 450000.00,
    target_users: 25,
    yearly_actuals: { 2564: 28 }
  },
  {
    project_code: 'PWA6-65-020',
    contract_no: 'สญ.วท-59/2565',
    branch_name: 'ร้อยเอ็ด',
    project_name: 'โครงการวางท่อเข้าซอยสุวรรณภูมิ ซอย 5 อ.สุวรรณภูมิ',
    project_type: 4,
    start_year: 2565,
    completion_year: 2565,
    budget: 380000.00,
    target_users: 20,
    yearly_actuals: { 2565: 18 }
  },
  {
    project_code: 'PWA6-65-003',
    contract_no: 'กปภ.ข.6-11/2565',
    branch_name: 'เลย',
    project_name: 'โครงการขยายเขตจำหน่ายน้ำ ต.กุดป่อง อ.เมืองเลย (งบลงทุน)',
    project_type: 1,
    start_year: 2565,
    completion_year: 2565,
    budget: 6800000.00,
    target_users: 200,
    yearly_actuals: { 2565: 90, 2566: 35, 2567: 28, 2568: 32, 2569: 25 }
  },
  {
    project_code: 'PWA6-66-001',
    contract_no: 'กปภ.ข.6-02/2566',
    branch_name: 'กาฬสินธุ์',
    project_name: 'โครงการขยายเขตระบบประปา ต.หลุบ อ.เมืองกาฬสินธุ์',
    project_type: 1,
    start_year: 2566,
    completion_year: 2566,
    budget: 3900000.00,
    target_users: 120,
    yearly_actuals: { 2566: 45, 2567: 22, 2568: 20, 2569: 18 }
  },
  {
    project_code: 'PWA6-66-005',
    contract_no: 'สญ.วท-02/2566',
    branch_name: 'ชุมแพ',
    project_name: 'โครงการวางท่อเข้าซอยร่วมใจพัฒนา ถนนมะลิวัลย์ อ.ชุมแพ',
    project_type: 4,
    start_year: 2566,
    completion_year: 2566,
    budget: 310000.00,
    target_users: 15,
    yearly_actuals: { 2566: 16 }
  }
];

const MONTHS_TH = [
  { num: 10, name: 'ตุลาคม' },
  { num: 11, name: 'พฤศจิกายน' },
  { num: 12, name: 'ธันวาคม' },
  { num: 1, name: 'มกราคม' },
  { num: 2, name: 'กุมภาพันธ์' },
  { num: 3, name: 'มีนาคม' },
  { num: 4, name: 'เมษายน' },
  { num: 5, name: 'พฤษภาคม' },
  { num: 6, name: 'มิถุนายน' },
  { num: 7, name: 'กรกฎาคม' },
  { num: 8, name: 'สิงหาคม' },
  { num: 9, name: 'กันยายน' }
];

async function seed() {
  try {
    console.log('Starting MySQL Seeding Process...');

    // 1. ตรวจสอบหรือสร้าง DB และเปิดการเชื่อมต่อ
    await db.initializeDatabase();

    // 2. สร้างโครงสร้างตาราง DDL
    for (const ddl of SCHEMA_DDL) {
      await db.query(ddl);
    }
    console.log('✓ Database Schema DDL executed successfully.');

    // 3. ล้างข้อมูลเก่า (หากมี) เพื่อหลีกเลี่ยงข้อจำกัด UNIQUE
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    await db.query('TRUNCATE TABLE pwa_branches;');
    await db.query('TRUNCATE TABLE projects;');
    await db.query('TRUNCATE TABLE monthly_actual_users;');
    await db.query('TRUNCATE TABLE project_yearly_performance;');
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Old tables truncated.');

    // 4. บันทึกข้อมูลสาขา
    for (const branch of MOCK_BRANCHES) {
      await db.query(
        'INSERT INTO pwa_branches (branch_name, province) VALUES (?, ?);',
        [branch.name, branch.province]
      );
    }
    console.log(`✓ Inserted ${MOCK_BRANCHES.length} branches.`);

    // อาเรย์สำหรับสะสมการทำ Bulk Insert เพื่อความเร็วมหาศาล
    const yearlyPerformanceRows = [];
    const monthlyActualUsersRows = [];

    // 5. บันทึกข้อมูลโครงการ และเตรียมข้อมูลสำหรับการทำ Bulk Insert
    for (const p of MOCK_PROJECTS) {
      // แทรกหัวโครงการลงตาราง projects
      await db.query(
        `INSERT INTO projects (project_code, contract_no, branch_name, project_name, project_type, start_year, completion_year, completed_date, budget, target_users)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [p.project_code, p.contract_no, p.branch_name, p.project_name, p.project_type, p.start_year, p.completion_year, `${p.completion_year}-01-01`, p.budget, p.target_users]
      );

      const allocations = [40, 0, 15, 15, 15, 15]; // สัดส่วนเป้าหมาย (ปี 0: 40%, ปี 1: 0%, ปี 2-5: 15% ต่อปี)

      if (p.project_type === 4) {
        // ประเภท 4 คุ้มทุนแค่ปีที่แล้วเสร็จ (ปีเดียว)
        const year = p.completion_year;
        const actVal = p.yearly_actuals[year] || 0;

        yearlyPerformanceRows.push([
          p.project_code,
          year,
          'completion_year',
          100.00,
          p.target_users,
          actVal
        ]);

        // แบ่งรายเดือนสำหรับปีแล้วเสร็จ
        let remaining = actVal;
        for (let idx = 0; idx < MONTHS_TH.length; idx++) {
          const m = MONTHS_TH[idx];
          let actual = 0;
          if (idx === 11) {
            actual = remaining;
          } else {
            actual = Math.min(remaining, Math.floor(Math.random() * (actVal / 5)));
            remaining -= actual;
          }

          monthlyActualUsersRows.push([
            p.project_code,
            p.project_name,
            p.branch_name,
            p.project_type,
            year,
            m.num,
            m.name,
            actual
          ]);
        }

      } else {
        // ประเภท 1-3 ประเมิน 5 ปีสะสม (ปี 0 - ปี 5)
        for (let i = 0; i <= 5; i++) {
          const currentYear = p.completion_year + i;
          const actVal = p.yearly_actuals[currentYear] || 0;
          const yearType = i === 0 ? 'completion_year' : i <= 4 ? `year_${i}` : 'year_5_plus';
          
          const targetPct = allocations[i];
          const yrTargetUsers = Math.round(p.target_users * (targetPct / 100));

          yearlyPerformanceRows.push([
            p.project_code,
            currentYear,
            yearType,
            targetPct,
            yrTargetUsers,
            actVal
          ]);

          // แบ่งรายเดือนลงตารางจำลอง
          let remaining = actVal;
          for (let idx = 0; idx < MONTHS_TH.length; idx++) {
            const m = MONTHS_TH[idx];
            let actual = 0;
            if (idx === 11) {
              actual = remaining;
            } else {
              actual = Math.min(remaining, Math.floor(Math.random() * (actVal / 5)));
              remaining -= actual;
            }

            monthlyActualUsersRows.push([
              p.project_code,
              p.project_name,
              p.branch_name,
              p.project_type,
              currentYear,
              m.num,
              m.name,
              actual
            ]);
          }
        }
      }
    }
    console.log(`✓ Inserted ${MOCK_PROJECTS.length} project headers.`);

    // 6. รัน Bulk Insert สำหรับข้อมูลรายปี
    if (yearlyPerformanceRows.length > 0) {
      await db.query(
        `INSERT INTO project_yearly_performance 
         (project_code, fiscal_year, year_type, target_percentage, target_users, actual_users) 
         VALUES ?;`,
        [yearlyPerformanceRows]
      );
      console.log(`✓ Bulk inserted ${yearlyPerformanceRows.length} performance tracking rows.`);
    }

    // 7. รัน Bulk Insert สำหรับข้อมูลรายเดือน
    if (monthlyActualUsersRows.length > 0) {
      await db.query(
        `INSERT INTO monthly_actual_users 
         (project_code, project_name, branch_name, project_type, fiscal_year, month_number, month_name, actual_users) 
         VALUES ?;`,
        [monthlyActualUsersRows]
      );
      console.log(`✓ Bulk inserted ${monthlyActualUsersRows.length} monthly actual user data rows.`);
    }

    console.log('🎉 Seeding successfully completed in milliseconds!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding process failed:', error.message);
    process.exit(1);
  }
}

seed();
