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

async function migrate() {
  try {
    console.log('Starting migration of real pcis.sql data to dashboard schema...');
    
    // Initialize DB connection
    await db.initializeDatabase();

    // 1. Truncate mock tables
    console.log('Truncating old mock tables...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    await db.query('TRUNCATE TABLE pwa_branches;');
    await db.query('TRUNCATE TABLE projects;');
    await db.query('TRUNCATE TABLE monthly_actual_users;');
    await db.query('TRUNCATE TABLE project_yearly_performance;');
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Mock tables truncated.');

    // 2. Fetch and insert branches
    console.log('Processing branches...');
    const rawBranches = await db.query('SELECT DISTINCT branch FROM plan_master WHERE branch IS NOT NULL AND branch != "";');
    const branchesToInsert = rawBranches.map(row => {
      const branchName = row.branch;
      const province = branchProvinces[branchName] || branchName; // Fallback to branch name as province if not in map
      return [branchName, province];
    });

    if (branchesToInsert.length > 0) {
      await db.query('INSERT INTO pwa_branches (branch_name, province) VALUES ?', [branchesToInsert]);
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
        proj_year AS completion_year, 
        COALESCE(budget, 0.00) AS budget, 
        COALESCE(target, 0) AS target_users
      FROM plan_master
      WHERE proj_no IS NOT NULL AND proj_no != '';
    `);

    const projectsToInsert = rawProjects.map(p => [
      p.project_code,
      p.contract_no,
      p.branch_name,
      p.project_name,
      p.project_type,
      p.start_year,
      p.completion_year,
      p.budget,
      p.target_users
    ]);

    if (projectsToInsert.length > 0) {
      // Chunk inserts just in case
      const chunkSize = 1000;
      for (let i = 0; i < projectsToInsert.length; i += chunkSize) {
        const chunk = projectsToInsert.slice(i, i + chunkSize);
        await db.query(`
          INSERT INTO projects 
            (project_code, contract_no, branch_name, project_name, project_type, start_year, completion_year, budget, target_users)
          VALUES ?
        `, [chunk]);
      }
      console.log(`✓ Inserted ${projectsToInsert.length} projects.`);
    }

    // Map projects by code for fast lookup
    const projectsMap = {};
    rawProjects.forEach(p => {
      projectsMap[p.project_code] = p;
    });

    // 4. Fetch and aggregate customer installation data
    console.log('Fetching and aggregating actual customer installations...');
    const rawActuals = await db.query(`
      SELECT 
        p.proj_no AS project_code,
        CAST(c.yearinstall AS SIGNED) AS install_year,
        CAST(SUBSTRING(c.contrac_date, 3, 2) AS SIGNED) AS month_number,
        COUNT(c.Id) AS count
      FROM proj_cus c
      JOIN plan_master p ON TRIM(c.project_no_proj) = TRIM(p.contract_no)
      WHERE c.yearinstall IS NOT NULL AND c.yearinstall != ''
        AND TRIM(p.contract_no) != ''
        AND TRIM(c.project_no_proj) != ''
      GROUP BY project_code, install_year, month_number;
    `);

    // Organize actuals in memory
    const projectActuals = {}; // project_code -> year -> month_number -> count
    rawActuals.forEach(row => {
      const code = row.project_code;
      const year = row.install_year;
      let month = parseInt(row.month_number || 0);
      if (month < 1 || month > 12) month = 10; // Default to October (start of fiscal year) if invalid
      const count = parseInt(row.count || 0);

      if (!projectActuals[code]) projectActuals[code] = {};
      if (!projectActuals[code][year]) projectActuals[code][year] = {};
      projectActuals[code][year][month] = (projectActuals[code][year][month] || 0) + count;
    });

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
      const compYear = p.completion_year;

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
    const [cols] = await db.query('SHOW COLUMNS FROM projects LIKE "latitude"');
    if (cols.length === 0) {
      await db.query('ALTER TABLE projects ADD COLUMN latitude DECIMAL(10, 7) NULL');
      await db.query('ALTER TABLE projects ADD COLUMN longitude DECIMAL(10, 7) NULL');
    }

    await db.query('DROP TEMPORARY TABLE IF EXISTS temp_project_coords');
    await db.query(`
      CREATE TEMPORARY TABLE temp_project_coords AS
      SELECT 
        TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci AS contract_no,
        AVG(CAST(c.LATITUDE AS DOUBLE)) AS avg_lat,
        AVG(CAST(c.LONGITUDE AS DOUBLE)) AS avg_lng
      FROM proj_cus pc
      JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      WHERE c.LATITUDE IS NOT NULL AND c.LATITUDE != '' AND c.LATITUDE != '0'
        AND c.LONGITUDE IS NOT NULL AND c.LONGITUDE != '' AND c.LONGITUDE != '0'
        AND TRIM(pc.project_no_proj) != ''
      GROUP BY contract_no
    `);

    const updateResult = await db.query(`
      UPDATE projects p
      JOIN temp_project_coords t ON CONVERT(p.contract_no USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(t.contract_no USING utf8mb4) COLLATE utf8mb4_unicode_ci
      SET p.latitude = t.avg_lat, p.longitude = t.avg_lng
    `);
    
    const notNullCount = await db.query(`SELECT count(*) as count FROM projects WHERE latitude IS NOT NULL`);
    console.log(`✓ Coordinates updated for ${notNullCount[0].count} projects.`);

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
