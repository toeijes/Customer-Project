const db = require('./db');

async function testApi() {
  try {
    await db.initializeDatabase();
    
    // Simulate query parameters: branch=all, year=2568, type=all
    const branch = 'all';
    const year = '2568';
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

    console.log('Querying summary metrics with params:', params);
    const metricsResult = await db.query(`
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

    console.log('Metrics result:', metricsResult[0]);
    process.exit(0);
  } catch (err) {
    console.error('API Test Failed:', err);
    process.exit(1);
  }
}

testApi();
