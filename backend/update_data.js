const db = require('./db');

const branchProvinces = {
  'เมืองพล': 'ขอนแก่น',
  'แก้งคร้อ': 'ชัยภูมิ',
  'โพนทอง': 'ร้อยเอ็ด',
  'กระนวน': 'ขอนแก่น',
  'กาฬสินธุ์': 'กาฬสินธุ์',
  'กุฉินารายณ์': 'กาฬสินธุ์',
  'ขอนแก่น': 'ขอนแก่น',
  'จัตุรัส': 'ชัยภูมิ',
  'ชนบท': 'ขอนแก่น',
  'ชัยภูมิ': 'ชัยภูมิ',
  'ชุมแพ': 'ขอนแก่น',
  'น้ำพอง': 'ขอนแก่น',
  'บ้านไผ่': 'ขอนแก่น',
  'บำเหน็จณรงค์': 'ชัยภูมิ',
  'พยัคฆภูมิพิสัย': 'มหาสารคาม',
  'ภูเขียว': 'ชัยภูมิ',
  'มหาสารคาม': 'มหาสารคาม',
  'ร้อยเอ็ด': 'ร้อยเอ็ด',
  'สมเด็จ': 'กาฬสินธุ์',
  'สุวรรณภูมิ': 'ร้อยเอ็ด',
  'หนองเรือ': 'ขอนแก่น',
  'หนองบัวแดง': 'ชัยภูมิ'
};

const MONTH_NAMES_TH = {
  1: 'ม.ค.', 2: 'ก.พ.', 3: 'มี.ค.', 4: 'เม.ย.', 5: 'พ.ค.', 6: 'มิ.ย.',
  7: 'ก.ค.', 8: 'ส.ค.', 9: 'ก.ย.', 10: 'ต.ค.', 11: 'พ.ย.', 12: 'ธ.ค.'
};

function parseCompletedDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return { year: y, month: m, day: d };
}

function parseBgncustdt(dateStr) {
  if (!dateStr || dateStr.length !== 6) return null;
  const y = parseInt(dateStr.substring(0, 2), 10) + 2500;
  const m = parseInt(dateStr.substring(2, 4), 10);
  const d = parseInt(dateStr.substring(4, 6), 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { year: y, month: m, day: d };
}

function parseBgnDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return {
      year: dateVal.getFullYear() + 543,
      month: dateVal.getMonth() + 1,
      day: dateVal.getDate()
    };
  }
  if (typeof dateVal === 'string') {
    // Expected format: YYYY-MM-DD
    const parts = dateVal.trim().split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { year: y + 543, month: m, day: d };
      }
    }
  }
  return null;
}

function isAfter(date1, date2) {
  if (!date1 || !date2) return false;
  if (date1.year !== date2.year) return date1.year > date2.year;
  if (date1.month !== date2.month) return date1.month > date2.month;
  return date1.day > date2.day;
}

async function updateData() {
  try {
    console.log('Starting update of calculated metrics from customer and installation data...');
    
    // Initialize DB connection
    await db.initializeDatabase();

    // Fix collation mismatch issues for all imported/created tables
    console.log('Verifying and fixing database collations to prevent mismatch errors...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    // Alter project table columns
    await db.query('ALTER TABLE projects MODIFY COLUMN project_code VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;');
    await db.query('ALTER TABLE projects MODIFY COLUMN contract_no VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;');
    
    // Alter customer table columns if table exists
    const customerTableExists = await db.query("SHOW TABLES LIKE 'customer'");
    if (customerTableExists.length > 0) {
      await db.query('ALTER TABLE customer MODIFY COLUMN cus_code VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    }
    
    // Alter proj_cus table columns if table exists
    const projCusTableExists = await db.query("SHOW TABLES LIKE 'proj_cus'");
    if (projCusTableExists.length > 0) {
      await db.query('ALTER TABLE proj_cus MODIFY COLUMN custcode VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
      await db.query('ALTER TABLE proj_cus MODIFY COLUMN project_no_proj VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
      await db.query('ALTER TABLE proj_cus MODIFY COLUMN project_no_pipe VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    }
    
    // Alter debt_trn table columns if table exists
    const debtTrnTableExists = await db.query("SHOW TABLES LIKE 'debt_trn'");
    if (debtTrnTableExists.length > 0) {
      await db.query('ALTER TABLE debt_trn MODIFY COLUMN cust_code VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
      await db.query('ALTER TABLE debt_trn MODIFY COLUMN debt_ym VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    }
    
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Collation alignment finished.');

    // Create eligible_customers if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS eligible_customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_code VARCHAR(50) NOT NULL,
        custcode VARCHAR(50) NOT NULL,
        fiscal_year INT NOT NULL,
        month_number TINYINT NOT NULL,
        UNIQUE KEY uq_project_custcode (project_code, custcode),
        INDEX idx_custcode (custcode),
        INDEX idx_project_code (project_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create monthly_actual_users if not exists and ensure early_users column
    await db.query(`
      CREATE TABLE IF NOT EXISTS monthly_actual_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_code VARCHAR(50) NOT NULL,
        project_name TEXT,
        branch_name VARCHAR(100),
        project_type TINYINT,
        fiscal_year INT,
        month_number TINYINT,
        month_name VARCHAR(50),
        actual_users INT DEFAULT 0,
        early_users INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await db.query('ALTER TABLE monthly_actual_users ADD COLUMN IF NOT EXISTS early_users INT DEFAULT 0;');
    } catch (e) {
      // Ignore if already exists
    }

    // 1. Truncate only the dynamic performance and eligible customer tables
    console.log('Truncating old metrics tables (eligible_customers, project_yearly_performance, monthly_actual_users)...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    await db.query('TRUNCATE TABLE monthly_actual_users;');
    await db.query('TRUNCATE TABLE project_yearly_performance;');
    await db.query('TRUNCATE TABLE eligible_customers;');
    await db.query('TRUNCATE TABLE project_monthly_usage;');
    await db.query('TRUNCATE TABLE project_usage_summary;');
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Dynamic tables truncated.');

    // 2. Fetch existing projects (no truncation of projects/pwa_branches)
    console.log('Fetching existing projects database...');
    const rawProjects = await db.query(`
      SELECT 
        project_code, 
        COALESCE(contract_no, '') AS contract_no, 
        COALESCE(branch_name, '') AS branch_name, 
        COALESCE(project_name, '') AS project_name, 
        project_type, 
        start_year, 
        completed_date,
        completion_year, 
        COALESCE(budget, 0.00) AS budget, 
        COALESCE(target_users, 0) AS target_users
      FROM projects
      WHERE project_code NOT LIKE 'PWA6-%' AND project_type IN (1, 2, 3, 4);
    `);

    // Map projects by code for fast lookup
    const projectsMap = {};
    rawProjects.forEach(p => {
      projectsMap[p.project_code] = {
        ...p,
        proj_year: p.start_year
      };
    });

    // 3. Fetch and aggregate customer installation data by joining with projects
    console.log('Fetching and aggregating actual customer installations...');
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
      WHERE (c.yearinstall IS NOT NULL OR cust.BGN_DATE IS NOT NULL OR c.bgncustdt IS NOT NULL)
        AND TRIM(p.contract_no) != ''
        AND TRIM(c.project_no_proj) != ''
        AND p.project_code NOT LIKE 'PWA6-%'
        AND p.project_type IN (1, 2, 3, 4)

      UNION

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
      JOIN projects p ON TRIM(c.project_no_pipe) = TRIM(p.contract_no)
      WHERE (c.yearinstall IS NOT NULL OR cust.BGN_DATE IS NOT NULL OR c.bgncustdt IS NOT NULL)
        AND TRIM(p.contract_no) != ''
        AND TRIM(c.project_no_pipe) != ''
        AND p.project_code NOT LIKE 'PWA6-%'
        AND p.project_type IN (1, 2, 3, 4);
    `);

    // Organize actuals in memory
    const projectActuals = {}; // project_code -> year -> month_number -> count
    const projectEarlyActuals = {}; // project_code -> year -> month_number -> count
    const eligibleCustomersRows = [];
    const seenCustomers = new Set();

    rawActuals.forEach(row => {
      const code = row.project_code;
      
      // Parse dates
      let compDate = parseCompletedDate(row.completed_date);
      if (!compDate && row.proj_year) {
        // Fallback to start of fiscal year: Oct 1st of (proj_year - 1)
        compDate = { year: row.proj_year - 1, month: 10, day: 1 };
      }

      let bgnDate = parseBgnDate(row.BGN_DATE);
      if (!bgnDate) {
        bgnDate = parseBgncustdt(row.bgncustdt);
      }
      
      // Only include customer if bgnDate is after project completion date
      if (!bgnDate || !compDate) {
        return; // skip if dates are missing
      }
      const isEarly = !isAfter(bgnDate, compDate);

      // Calculate fiscal year based on bgnDate instead of c.yearinstall
      const year = bgnDate.month >= 10 ? bgnDate.year + 1 : bgnDate.year;
      if (isNaN(year) || year === 0) return;

      // Only include if the connection has actually occurred (not in the future)
      const now = new Date();
      const curMonth = now.getMonth() + 1; // 1-12
      const curYearBE = now.getFullYear() + 543;
      const curFiscalYear = curMonth >= 10 ? curYearBE + 1 : curYearBE;
      const curFiscalIndex = curMonth >= 10 ? curMonth - 10 : curMonth + 2;

      let isFuture = false;
      if (year > curFiscalYear) {
        isFuture = true;
      } else if (year === curFiscalYear) {
        const itemFiscalIndex = bgnDate.month >= 10 ? bgnDate.month - 10 : bgnDate.month + 2;
        if (itemFiscalIndex > curFiscalIndex) {
          isFuture = true;
        }
      }
      if (isFuture) {
        return; // skip future connection
      }



      // Determine month of connection (use bgnDate if available, otherwise contrac_date)
      let month = 10;
      if (bgnDate) {
        month = bgnDate.month;
      } else if (row.contrac_date && row.contrac_date.length >= 4) {
        const mStr = row.contrac_date.substring(2, 4);
        const mVal = parseInt(mStr, 10);
        if (!isNaN(mVal) && mVal >= 1 && mVal <= 12) {
          month = mVal;
        }
      }

      if (isEarly) {
        if (!projectEarlyActuals[code]) projectEarlyActuals[code] = {};
        if (!projectEarlyActuals[code][year]) projectEarlyActuals[code][year] = {};
        projectEarlyActuals[code][year][month] = (projectEarlyActuals[code][year][month] || 0) + 1;
        return; // skip early users from eligible_customers and normal actuals
      }

      // ตรวจสอบเงื่อนไขกรอบเวลาประเมิน: ประเภท 4 = 1 ปี, ประเภท 1-3 = สะสม 5 ปี (ปี 0 ถึง 5)
      // กรองผู้ใช้น้ำที่มาลงทะเบียนนอกเหนือช่วงเวลาประเมินออกทันทีตั้งแต่ต้นทาง
      // เพื่อป้องกันการแสดงผลผู้ใช้หรือการดึงสถิติใช้น้ำผิดพลาดในทุกๆ หน้าของระบบ
      const pInfo = projectsMap[code];
      if (pInfo) {
        const compYear = pInfo.completion_year;
        const type = pInfo.project_type;
        let isValidYear = false;
        if (type === 4) {
          isValidYear = (year === compYear);
        } else {
          isValidYear = (year >= compYear && year <= compYear + 5);
        }
        if (!isValidYear) return; // ข้ามหากอยู่นอกเวลาประเมินผล
      }

      if (!projectActuals[code]) projectActuals[code] = {};
      if (!projectActuals[code][year]) projectActuals[code][year] = {};
      projectActuals[code][year][month] = (projectActuals[code][year][month] || 0) + 1;

      // Track eligible customer
      const key = `${code}-${row.custcode}`;
      if (!seenCustomers.has(key)) {
        seenCustomers.add(key);
        eligibleCustomersRows.push([
          code,
          row.custcode,
          year,
          month
        ]);
      }
    });

    // Bulk insert eligible customers
    if (eligibleCustomersRows.length > 0) {
      console.log('Inserting eligible customers records...');
      const chunkSize = 2000;
      for (let i = 0; i < eligibleCustomersRows.length; i += chunkSize) {
        const chunk = eligibleCustomersRows.slice(i, i + chunkSize);
        await db.query(`
          INSERT INTO eligible_customers 
            (project_code, custcode, fiscal_year, month_number)
          VALUES ?
        `, [chunk]);
      }
      console.log(`✓ Inserted ${eligibleCustomersRows.length} eligible customer records.`);
    }

    // Helper functions for actuals lookup
    function getActualForYear(code, year) {
      if (!projectActuals[code] || !projectActuals[code][year]) return 0;
      return Object.values(projectActuals[code][year]).reduce((sum, val) => sum + val, 0);
    }

    function getActualForYear5Plus(code, completionYear) {
      if (!projectActuals[code]) return 0;
      let total = 0;
      for (const yearStr in projectActuals[code]) {
        const year = parseInt(yearStr);
        // แก้ไขข้อผิดพลาดเดิม: จากเดิมที่เอาปีที่ 5 และทุกปีถัดไป (>= completionYear + 5) มารวมกัน
        // เปลี่ยนเป็นคัดเลือกเอาเฉพาะข้อมูลของปีประเมินปีที่ 5 (completionYear + 5) เท่านั้น เพื่อไม่ให้นับผู้ใช้น้ำที่เข้ามาหลังจากปีประเมินที่ 5 เป็นต้นไป
        // ตรงตามเงื่อนไขประเมินผลสะสม 5 ปี (ปีที่ 0 ถึง 5) สำหรับโครงการประเภท 1, 2, 3
        if (year === completionYear + 5) {
          total += Object.values(projectActuals[code][year]).reduce((sum, val) => sum + val, 0);
        }
      }
      return total;
    }

    // 4. Build yearly performance rows
    console.log('Generating yearly performance statistics...');
    const yearlyPerformanceRows = [];
    rawProjects.forEach(p => {
      const code = p.project_code;
      const target = p.target_users;
      const type = p.project_type;
      const compYear = projectsMap[code].completion_year;

      if (type === 4) {
        // Project type 4: assessed only in completion year (100% target)
        const actualVal = getActualForYear(code, compYear);
        yearlyPerformanceRows.push([
          code,
          compYear,
          'completion_year',
          100.00,
          target,
          actualVal
        ]);
      } else {
        // Project types 1, 2, 3: 5-year timeline (Year 0 + Year 1 combined: 40%, Years 2-5: 15% each)
        const allocations = [40, 0, 15, 15, 15, 15]; // Year 0: 40%, Year 1: 0%, Year 2-5: 15% each
        for (let i = 0; i <= 5; i++) {
          const currentYear = compYear + i;
          const yearType = i === 0 ? 'completion_year' : i <= 4 ? `year_${i}` : 'year_5_plus';
          const targetPct = allocations[i];
          const yrTargetUsers = Math.round(target * (targetPct / 100));
          
          let actualVal = 0;
          if (i === 5) {
            actualVal = getActualForYear5Plus(code, compYear);
          } else {
            actualVal = getActualForYear(code, currentYear);
          }

          yearlyPerformanceRows.push([
            code,
            currentYear,
            yearType,
            targetPct,
            yrTargetUsers,
            actualVal
          ]);
        }
      }
    });

    if (yearlyPerformanceRows.length > 0) {
      console.log('Inserting yearly performance rows...');
      const chunkSize = 2000;
      for (let i = 0; i < yearlyPerformanceRows.length; i += chunkSize) {
        const chunk = yearlyPerformanceRows.slice(i, i + chunkSize);
        await db.query(`
          INSERT INTO project_yearly_performance 
            (project_code, fiscal_year, year_type, target_percentage, target_users, actual_users)
          VALUES ?
        `, [chunk]);
      }
      console.log(`✓ Inserted ${yearlyPerformanceRows.length} yearly performance rows.`);
    }

    // 5. Build monthly actual users rows
    console.log('Generating monthly trend records...');
    const consolidatedMonthly = {};
    for (const code in projectActuals) {
      const pInfo = projectsMap[code];
      if (!pInfo) continue;

      for (const yearStr in projectActuals[code]) {
        const year = parseInt(yearStr);

        // Filter out installations that do not fall within the project's evaluation timeframe
        const compYear = pInfo.completion_year;
        const type = pInfo.project_type;
        let isValidYear = false;
        
        if (type === 4) {
          // โครงการวางท่อเข้าซอย (ประเภท 4): นับเฉพาะผู้ใช้น้ำที่ลงทะเบียนในปีที่แล้วเสร็จ (ปีที่ 0) เท่านั้น
          isValidYear = (year === compYear);
        } else {
          // โครงการประเภท 1, 2, 3 (งบปกติ): นับเฉพาะผู้ใช้น้ำที่ลงทะเบียนตั้งแต่ปีแล้วเสร็จ (ปีที่ 0) ถึง ปีประเมินที่ 5 (รวม 6 ปีงบประมาณ)
          // จะคัดกรองข้อมูลผู้ใช้ที่ติดตั้งหลังจากปีประเมินปีที่ 5 ทิ้งไป (ไม่นำมารวมแสดงในตารางผลงาน Matrix Grid)
          isValidYear = (year >= compYear && year <= compYear + 5);
        }

        if (!isValidYear) continue;

        for (const monthStr in projectActuals[code][year]) {
          const monthNum = parseInt(monthStr);
          const count = projectActuals[code][year][monthNum];
          if (count > 0) {
            // Normalize the project code (trim and uppercase) to merge entries that MySQL collates together
            const normCode = code.trim().toUpperCase();
            const key = `${normCode}-${year}-${monthNum}`;
            if (consolidatedMonthly[key]) {
              consolidatedMonthly[key].count += count;
            } else {
              consolidatedMonthly[key] = {
                code: pInfo.project_code, // Use the correct casing from projectsMap
                project_name: pInfo.project_name,
                branch_name: pInfo.branch_name,
                project_type: pInfo.project_type,
                year: year,
                monthNum: monthNum,
                count: count,
                early: 0
              };
            }
          }
        }
      }
    }

    for (const code in projectEarlyActuals) {
      const pInfo = projectsMap[code];
      if (!pInfo) continue;
      for (const yearStr in projectEarlyActuals[code]) {
        const year = parseInt(yearStr);
        for (const monthStr in projectEarlyActuals[code][year]) {
          const monthNum = parseInt(monthStr);
          const count = projectEarlyActuals[code][year][monthNum];
          if (count > 0) {
            const normCode = code.trim().toUpperCase();
            const key = `${normCode}-${year}-${monthNum}`;
            if (consolidatedMonthly[key]) {
              consolidatedMonthly[key].early = (consolidatedMonthly[key].early || 0) + count;
            } else {
              consolidatedMonthly[key] = {
                code: pInfo.project_code,
                project_name: pInfo.project_name,
                branch_name: pInfo.branch_name,
                project_type: pInfo.project_type,
                year: year,
                monthNum: monthNum,
                count: 0,
                early: count
              };
            }
          }
        }
      }
    }

    const monthlyActualUsersRows = Object.values(consolidatedMonthly).map(item => [
      item.code,
      item.project_name,
      item.branch_name,
      item.project_type,
      item.year,
      item.monthNum,
      MONTH_NAMES_TH[item.monthNum] || 'ม.ค.',
      item.count,
      item.early || 0
    ]);

    if (monthlyActualUsersRows.length > 0) {
      console.log('Inserting monthly actual users rows...');
      const chunkSize = 5000;
      for (let i = 0; i < monthlyActualUsersRows.length; i += chunkSize) {
        const chunk = monthlyActualUsersRows.slice(i, i + chunkSize);
        await db.query(`
          INSERT INTO monthly_actual_users 
            (project_code, project_name, branch_name, project_type, fiscal_year, month_number, month_name, actual_users, early_users)
          VALUES ?
        `, [chunk]);
      }
      console.log(`✓ Inserted ${monthlyActualUsersRows.length} monthly trend rows.`);
    }

    // 6. Calculate and update average coordinates for projects (from customer coordinates)
    console.log('Calculating average coordinates for projects from customer locations...');
    
    await db.query('DROP TEMPORARY TABLE IF EXISTS temp_project_coords');
    await db.query(`
      CREATE TEMPORARY TABLE temp_project_coords AS
      SELECT 
        contract_no,
        AVG(lat) AS avg_lat,
        AVG(lng) AS avg_lng
      FROM (
        SELECT 
          pc.custcode,
          TRIM(pc.project_no_proj) AS contract_no,
          CAST(c.LATITUDE AS DOUBLE) AS lat,
          CAST(c.LONGITUDE AS DOUBLE) AS lng
        FROM proj_cus pc
        JOIN customer c ON pc.custcode = c.cus_code
        WHERE c.LATITUDE IS NOT NULL AND c.LATITUDE != '' AND c.LATITUDE != '0'
          AND c.LONGITUDE IS NOT NULL AND c.LONGITUDE != '' AND c.LONGITUDE != '0'
          AND TRIM(pc.project_no_proj) != ''
        UNION
        SELECT 
          pc.custcode,
          TRIM(pc.project_no_pipe) AS contract_no,
          CAST(c.LATITUDE AS DOUBLE) AS lat,
          CAST(c.LONGITUDE AS DOUBLE) AS lng
        FROM proj_cus pc
        JOIN customer c ON pc.custcode = c.cus_code
        WHERE c.LATITUDE IS NOT NULL AND c.LATITUDE != '' AND c.LATITUDE != '0'
          AND c.LONGITUDE IS NOT NULL AND c.LONGITUDE != '' AND c.LONGITUDE != '0'
          AND TRIM(pc.project_no_pipe) != ''
      ) t
      GROUP BY contract_no
    `);

    const updateResult = await db.query(`
      UPDATE projects p
      JOIN temp_project_coords t ON TRIM(p.contract_no) = TRIM(t.contract_no)
      SET p.latitude = t.avg_lat, p.longitude = t.avg_lng
    `);
    
    const notNullCount = await db.query(`SELECT count(*) as count FROM projects WHERE latitude IS NOT NULL`);
    console.log(`✓ Coordinates updated for ${notNullCount[0].count} projects.`);

    // ตรวจสอบโครงการที่มีปัญหาเรื่องพิกัด
    const nullCoordsProj = await db.query(`
      SELECT project_code, contract_no, project_name 
      FROM projects 
      WHERE (latitude IS NULL OR longitude IS NULL) AND project_type IN (1, 2, 3, 4) AND project_code NOT LIKE 'PWA6-%'
    `);
    
    const invalidCoordsProj = await db.query(`
      SELECT project_code, contract_no, project_name, latitude, longitude
      FROM projects 
      WHERE (latitude IS NOT NULL AND longitude IS NOT NULL) 
        AND (latitude < 15.0 OR latitude > 18.0 OR longitude < 101.0 OR longitude > 105.0)
        AND project_type IN (1, 2, 3, 4) AND project_code NOT LIKE 'PWA6-%'
    `);

    if (nullCoordsProj.length > 0) {
      console.warn(`\n⚠️ [คำเตือน] พบ ${nullCoordsProj.length} โครงการที่ไม่มีพิกัด (NULL) บนแผนที่:`);
      nullCoordsProj.forEach(p => {
        console.warn(`   - [รหัส: ${p.project_code}] ${p.project_name} (สัญญา: ${p.contract_no || 'ไม่มี'})`);
      });
    }

    if (invalidCoordsProj.length > 0) {
      console.warn(`\n⚠️ [คำเตือน] พบ ${invalidCoordsProj.length} โครงการที่มีพิกัดนอกขอบเขตพื้นที่รับผิดชอบ กปภ.ข.6 (15.0-18.0, 101.0-105.0):`);
      invalidCoordsProj.forEach(p => {
        console.warn(`   - [รหัส: ${p.project_code}] ${p.project_name} (พิกัด: ${p.latitude}, ${p.longitude})`);
      });
    }

    // 7. Populate Water Usage Summary Tables
    console.log('Generating water usage summary tables (project_monthly_usage, project_usage_summary)...');
    
    // เติมข้อมูลลงตาราง project_usage_summary
    await db.query(`
      INSERT INTO project_usage_summary (project_code, total_users)
      SELECT 
        p.project_code,
        COUNT(DISTINCT dt.cust_code)
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      WHERE ((p.project_type = 4 AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year, '09')) 
          OR 
          (p.project_type IN (1, 2, 3) AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year + 5, '09')))
      GROUP BY p.project_code
    `);
    
    // เติมข้อมูลลงตาราง project_monthly_usage
    await db.query(`
      INSERT INTO project_monthly_usage (project_code, debt_ym, total_bills, total_usage, total_amount)
      SELECT 
        p.project_code,
        dt.debt_ym,
        COUNT(dt.id),
        COALESCE(SUM(dt.present_water_usg), 0),
        COALESCE(SUM(dt.total_water_amt), 0)
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      WHERE ((p.project_type = 4 AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year, '09')) 
          OR 
          (p.project_type IN (1, 2, 3) AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year + 5, '09')))
      GROUP BY p.project_code, dt.debt_ym
    `);
    
    console.log('✓ Water usage summary tables populated successfully.');

    // Data consistency validation
    const sumYearly = await db.query('SELECT SUM(actual_users) as total FROM project_yearly_performance');
    const sumMonthly = await db.query('SELECT SUM(actual_users) as total FROM monthly_actual_users');
    const totalYearly = parseInt(sumYearly[0].total || 0, 10);
    const totalMonthly = parseInt(sumMonthly[0].total || 0, 10);

    if (totalYearly !== totalMonthly) {
      console.warn('\n⚠️ [WARNING] ข้อมูลรวมผู้ใช้จริงสะสมไม่ตรงกัน!');
      console.warn(` - ยอดรวมรายโครงการ (project_yearly_performance): ${totalYearly} ราย`);
      console.warn(` - ยอดรวมรายสาขา/รายเดือน (monthly_actual_users): ${totalMonthly} ราย`);
    } else {
      console.log(`✓ ตรวจสอบความถูกต้องของข้อมูลสำเร็จ: ยอดรวมผู้ใช้น้ำสะสมตรงกันที่ ${totalYearly} ราย`);
    }

    console.log('\n======================================================');
    console.log(' DATABASE UPDATES (update_data.js) COMPLETED SUCCESSFULLY!');
    console.log(` - Dynamic tables updated.`);
    console.log(` - Yearly Performance rows: ${yearlyPerformanceRows.length}`);
    console.log(` - Monthly actual users rows: ${monthlyActualUsersRows.length}`);
    console.log('======================================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Updates failed with error:', error);
    process.exit(1);
  }
}

updateData();
