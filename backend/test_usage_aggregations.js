const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    const branch = 'all';
    const year = 'all';
    const type = 'all';
    
    // Build filter parts
    let whereClauses = [];
    let params = [];
    
    if (branch && branch !== 'all') {
      whereClauses.push('p.branch_name = ?');
      params.push(branch);
    }
    if (type && type !== 'all') {
      whereClauses.push('p.project_type = ?');
      params.push(parseInt(type));
    }
    if (year && year !== 'all') {
      whereClauses.push('(CAST(SUBSTRING(dt.debt_ym, 1, 4) AS SIGNED) + CASE WHEN CAST(SUBSTRING(dt.debt_ym, 5, 2) AS SIGNED) >= 10 THEN 1 ELSE 0 END) = ?');
      params.push(parseInt(year));
    }
    
    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    console.log('1. Summary Metrics...');
    const start1 = Date.now();
    const summaryResult = await db.query(`
      SELECT 
        COUNT(DISTINCT dt.cust_code) as total_users,
        COUNT(dt.id) as total_bills,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
    `, params);
    console.log('Metrics:', summaryResult[0], 'in', Date.now() - start1, 'ms');

    console.log('2. Monthly Breakdown...');
    const start2 = Date.now();
    const monthlyResult = await db.query(`
      SELECT 
        SUBSTRING(dt.debt_ym, 5, 2) as month_num,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
      GROUP BY SUBSTRING(dt.debt_ym, 5, 2)
      ORDER BY month_num ASC
    `, params);
    console.log('Monthly rows count:', monthlyResult.length, 'in', Date.now() - start2, 'ms');

    console.log('3. Yearly Breakdown...');
    const start3 = Date.now();
    const yearlyResult = await db.query(`
      SELECT 
        (CAST(SUBSTRING(dt.debt_ym, 1, 4) AS SIGNED) + CASE WHEN CAST(SUBSTRING(dt.debt_ym, 5, 2) AS SIGNED) >= 10 THEN 1 ELSE 0 END) as fiscal_year,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
      GROUP BY (CAST(SUBSTRING(dt.debt_ym, 1, 4) AS SIGNED) + CASE WHEN CAST(SUBSTRING(dt.debt_ym, 5, 2) AS SIGNED) >= 10 THEN 1 ELSE 0 END)
      ORDER BY fiscal_year DESC
    `, params);
    console.log('Yearly:', yearlyResult, 'in', Date.now() - start3, 'ms');

    console.log('4. Branch Breakdown...');
    const start4 = Date.now();
    const branchResult = await db.query(`
      SELECT 
        p.branch_name,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
      GROUP BY p.branch_name
      ORDER BY total_usage DESC
    `, params);
    console.log('Branch count:', branchResult.length, 'in', Date.now() - start4, 'ms');

    console.log('5. Project Breakdown...');
    const start5 = Date.now();
    const projectResult = await db.query(`
      SELECT 
        p.project_code,
        p.project_name,
        p.project_type,
        p.branch_name,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
      GROUP BY p.project_code, p.project_name, p.project_type, p.branch_name
      ORDER BY total_usage DESC
      LIMIT 100
    `, params);
    console.log('Project count:', projectResult.length, 'in', Date.now() - start5, 'ms');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
