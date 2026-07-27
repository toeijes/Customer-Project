const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('Running UNION EXPLAIN...');
    const explainResult = await db.query(`
      EXPLAIN SELECT 
        COUNT(dt.cust_code) as total_bills,
        SUM(dt.present_water_usg) as total_usage,
        SUM(dt.total_water_amt) as total_amt
      FROM (
        SELECT DISTINCT pc.custcode
        FROM proj_cus pc
        JOIN projects p ON pc.project_no_proj = p.contract_no AND p.contract_no != ''
        UNION
        SELECT DISTINCT pc.custcode
        FROM proj_cus pc
        JOIN projects p ON pc.project_no_pipe = p.contract_no AND p.contract_no != ''
      ) c
      JOIN debt_trn dt ON c.custcode = dt.cust_code
    `);
    console.log('EXPLAIN:', JSON.stringify(explainResult, null, 2));

    console.log('Running UNION query...');
    const start = Date.now();
    const result = await db.query(`
      SELECT 
        COUNT(dt.cust_code) as total_bills,
        SUM(dt.present_water_usg) as total_usage,
        SUM(dt.total_water_amt) as total_amt
      FROM (
        SELECT DISTINCT pc.custcode
        FROM proj_cus pc
        JOIN projects p ON pc.project_no_proj = p.contract_no AND p.contract_no != ''
        UNION
        SELECT DISTINCT pc.custcode
        FROM proj_cus pc
        JOIN projects p ON pc.project_no_pipe = p.contract_no AND p.contract_no != ''
      ) c
      JOIN debt_trn dt ON c.custcode = dt.cust_code
    `);
    console.log('Result:', result);
    console.log('Query finished in', Date.now() - start, 'ms');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
}

run();
