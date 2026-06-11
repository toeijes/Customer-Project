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

async function migrate() {
  try {
    console.log('Starting migration of real pcis.sql data to dashboard schema...');
    
    // Initialize DB connection
    await db.initializeDatabase();

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

    // 1. Truncate mock tables
    console.log('Truncating old mock tables...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    await db.query('TRUNCATE TABLE pwa_branches;');
    await db.query('TRUNCATE TABLE projects;');
    await db.query('TRUNCATE TABLE monthly_actual_users;');
    await db.query('TRUNCATE TABLE project_yearly_performance;');
    await db.query('TRUNCATE TABLE eligible_customers;');
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Mock tables truncated.');

    // 2. Fetch and insert branches
    console.log('Processing branches...');
    const rawBranches = await db.query(`
      SELECT branch, MIN(ba) as ba 
      FROM plan_master 
      WHERE branch IS NOT NULL AND branch != "" 
      GROUP BY branch;
    `);
    const branchesToInsert = rawBranches.map(row => {
      const branchName = row.branch;
      const province = branchProvinces[branchName] || branchName; // Fallback to branch name as province if not in map
      return [branchName, province, row.ba];
    });

    if (branchesToInsert.length > 0) {
      await db.query('INSERT INTO pwa_branches (branch_name, province, ba) VALUES ?', [branchesToInsert]);
      console.log(`✓ Inserted ${branchesToInsert.length} real branches.`);
    }

    // 3. Fetch projects from plan_master
    console.log('Processing projects...');
    const rawProjects = await db.query(`
      SELECT 
        proj_no AS project_code, 
        COALESCE(contract_no, '') AS contract_no, 
        COALESCE(branch, '') AS branch_name, 
        COALESCE(proj_name, '') AS project_name, 
        CAST(type_proj AS SIGNED) AS project_type, 
        proj_year AS start_year, 
        completed_date,
        proj_year AS completion_year, 
        COALESCE(budget, 0.00) AS budget, 
        COALESCE(target, 0) AS target_users
      FROM plan_master
      WHERE proj_no IS NOT NULL AND proj_no != ''
        AND proj_no NOT LIKE 'PWA6-%' AND CAST(type_proj AS SIGNED) IN (1, 2, 3, 4);
    `);

    const projectsToInsert = rawProjects.map(p => {
      let compYear = p.start_year;
      const compDate = parseCompletedDate(p.completed_date);
      if (compDate) {
        compYear = compDate.month >= 10 ? compDate.year + 1 : compDate.year;
      }
      return [
        p.project_code,
        p.contract_no,
        p.branch_name,
        p.project_name,
        p.project_type,
        p.start_year,
        compYear,
        p.completed_date,
        p.budget,
        p.target_users
      ];
    });

    if (projectsToInsert.length > 0) {
      // Chunk inserts just in case
      const chunkSize = 1000;
      for (let i = 0; i < projectsToInsert.length; i += chunkSize) {
        const chunk = projectsToInsert.slice(i, i + chunkSize);
        await db.query(`
          INSERT INTO projects 
            (project_code, contract_no, branch_name, project_name, project_type, start_year, completion_year, completed_date, budget, target_users)
          VALUES ?
        `, [chunk]);
      }
      console.log(`✓ Inserted ${projectsToInsert.length} projects.`);
    }

    // Map projects by code for fast lookup
    const projectsMap = {};
    rawProjects.forEach(p => {
      let compYear = p.start_year;
      const compDate = parseCompletedDate(p.completed_date);
      if (compDate) {
        compYear = compDate.month >= 10 ? compDate.year + 1 : compDate.year;
      }
      projectsMap[p.project_code] = {
        ...p,
        completion_year: compYear
      };
    });

    // 4. Fetch and aggregate customer installation data
    console.log('Fetching and aggregating actual customer installations...');
    const rawActuals = await db.query(`
      SELECT 
        c.custcode,
        p.proj_no AS project_code,
        c.yearinstall,
        c.contrac_date,
        c.bgncustdt,
        cust.BGN_DATE,
        p.completed_date,
        p.proj_year
      FROM proj_cus c
      LEFT JOIN customer cust ON CONVERT(c.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = cust.cus_code
      JOIN plan_master p ON TRIM(CONVERT(c.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(CONVERT(p.contract_no USING utf8mb4)) COLLATE utf8mb4_unicode_ci
      WHERE (c.yearinstall IS NOT NULL OR cust.BGN_DATE IS NOT NULL OR c.bgncustdt IS NOT NULL)
        AND TRIM(p.contract_no) != ''
        AND TRIM(c.project_no_proj) != ''
        AND p.proj_no NOT LIKE 'PWA6-%'
        AND CAST(p.type_proj AS SIGNED) IN (1, 2, 3, 4)

      UNION

      SELECT 
        c.custcode,
        p.proj_no AS project_code,
        c.yearinstall,
        c.contrac_date,
        c.bgncustdt,
        cust.BGN_DATE,
        p.completed_date,
        p.proj_year
      FROM proj_cus c
      LEFT JOIN customer cust ON CONVERT(c.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = cust.cus_code
      JOIN plan_master p ON TRIM(CONVERT(c.project_no_pipe USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(CONVERT(p.contract_no USING utf8mb4)) COLLATE utf8mb4_unicode_ci
      WHERE (c.yearinstall IS NOT NULL OR cust.BGN_DATE IS NOT NULL OR c.bgncustdt IS NOT NULL)
        AND TRIM(p.contract_no) != ''
        AND TRIM(c.project_no_pipe) != ''
        AND p.proj_no NOT LIKE 'PWA6-%'
        AND CAST(p.type_proj AS SIGNED) IN (1, 2, 3, 4);
    `);

    // Organize actuals in memory
    const projectActuals = {}; // project_code -> year -> month_number -> count
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
      if (!bgnDate || !compDate || !isAfter(bgnDate, compDate)) {
        return; // skip this user
      }

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
        if (year >= completionYear + 5) {
          total += Object.values(projectActuals[code][year]).reduce((sum, val) => sum + val, 0);
        }
      }
      return total;
    }

    // 5. Build yearly performance rows
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

    // 6. Build monthly actual users rows
    console.log('Generating monthly trend records...');
    const monthlyActualUsersRows = [];
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
          isValidYear = (year === compYear);
        } else {
          isValidYear = (year >= compYear);
        }

        if (!isValidYear) continue;

        for (const monthStr in projectActuals[code][year]) {
          const monthNum = parseInt(monthStr);
          const count = projectActuals[code][year][monthNum];
          if (count > 0) {
            monthlyActualUsersRows.push([
              code,
              pInfo.project_name,
              pInfo.branch_name,
              pInfo.project_type,
              year,
              monthNum,
              MONTH_NAMES_TH[monthNum] || 'ม.ค.',
              count
            ]);
          }
        }
      }
    }

    if (monthlyActualUsersRows.length > 0) {
      console.log('Inserting monthly actual users rows...');
      const chunkSize = 5000;
      for (let i = 0; i < monthlyActualUsersRows.length; i += chunkSize) {
        const chunk = monthlyActualUsersRows.slice(i, i + chunkSize);
        await db.query(`
          INSERT INTO monthly_actual_users 
            (project_code, project_name, branch_name, project_type, fiscal_year, month_number, month_name, actual_users)
          VALUES ?
        `, [chunk]);
      }
      console.log(`✓ Inserted ${monthlyActualUsersRows.length} monthly trend rows.`);
    }

    // 7. Calculate and update average coordinates for projects (from customer coordinates)
    console.log('Calculating average coordinates for projects from customer locations...');
    
    // Ensure columns exist
    const cols = await db.query('SHOW COLUMNS FROM projects LIKE "latitude"');
    if (cols.length === 0) {
      await db.query('ALTER TABLE projects ADD COLUMN latitude DECIMAL(10, 7) NULL');
      await db.query('ALTER TABLE projects ADD COLUMN longitude DECIMAL(10, 7) NULL');
    }

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
          TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci AS contract_no,
          CAST(c.LATITUDE AS DOUBLE) AS lat,
          CAST(c.LONGITUDE AS DOUBLE) AS lng
        FROM proj_cus pc
        JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
        WHERE c.LATITUDE IS NOT NULL AND c.LATITUDE != '' AND c.LATITUDE != '0'
          AND c.LONGITUDE IS NOT NULL AND c.LONGITUDE != '' AND c.LONGITUDE != '0'
          AND TRIM(pc.project_no_proj) != ''
        UNION
        SELECT 
          pc.custcode,
          TRIM(CONVERT(pc.project_no_pipe USING utf8mb4)) COLLATE utf8mb4_unicode_ci AS contract_no,
          CAST(c.LATITUDE AS DOUBLE) AS lat,
          CAST(c.LONGITUDE AS DOUBLE) AS lng
        FROM proj_cus pc
        JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
        WHERE c.LATITUDE IS NOT NULL AND c.LATITUDE != '' AND c.LATITUDE != '0'
          AND c.LONGITUDE IS NOT NULL AND c.LONGITUDE != '' AND c.LONGITUDE != '0'
          AND TRIM(pc.project_no_pipe) != ''
      ) t
      GROUP BY contract_no
    `);

    const updateResult = await db.query(`
      UPDATE projects p
      JOIN temp_project_coords t ON CONVERT(p.contract_no USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(t.contract_no USING utf8mb4) COLLATE utf8mb4_unicode_ci
      SET p.latitude = t.avg_lat, p.longitude = t.avg_lng
    `);
    
    const notNullCount = await db.query(`SELECT count(*) as count FROM projects WHERE latitude IS NOT NULL`);
    console.log(`✓ Coordinates updated for ${notNullCount[0].count} projects.`);

    // ตรวจสอบความสอดคล้องของข้อมูล
    const sumYearly = await db.query('SELECT SUM(actual_users) as total FROM project_yearly_performance');
    const sumMonthly = await db.query('SELECT SUM(actual_users) as total FROM monthly_actual_users');
    const totalYearly = parseInt(sumYearly[0].total || 0, 10);
    const totalMonthly = parseInt(sumMonthly[0].total || 0, 10);

    if (totalYearly !== totalMonthly) {
      console.warn('\n⚠️ [WARNING] ข้อมูลรวมผู้ใช้จริงสะสมไม่ตรงกัน!');
      console.warn(` - ยอดรวมรายโครงการ (project_yearly_performance): ${totalYearly} ราย`);
      console.warn(` - ยอดรวมรายสาขา/รายเดือน (monthly_actual_users): ${totalMonthly} ราย`);
      console.warn('กรุณาตรวจสอบเงื่อนไขตัวกรองปีและวันที่ของทั้งสองตารางในไฟล์ migrate.js\n');
    } else {
      console.log(`✓ ตรวจสอบความถูกต้องของข้อมูลสำเร็จ: ยอดรวมผู้ใช้น้ำสะสมตรงกันที่ ${totalYearly} ราย`);
    }

    console.log('\n======================================================');
    console.log(' MIGRATION COMPLETED SUCCESSFULLY!');
    console.log(' Real customer data from pcis.sql integrated.');
    console.log(` - Branches inserted: ${branchesToInsert.length}`);
    console.log(` - Projects inserted: ${projectsToInsert.length}`);
    console.log(` - Yearly Performance rows: ${yearlyPerformanceRows.length}`);
    console.log(` - Monthly actual users rows: ${monthlyActualUsersRows.length}`);
    console.log('======================================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed with error:', error);
    process.exit(1);
  }
}

migrate();
