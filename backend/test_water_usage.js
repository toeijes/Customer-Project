const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('Testing water usage aggregation query...');
    const start = Date.now();
    const result = await db.query(`
      SELECT 
        COUNT(dt.cust_code) as total_bills,
        SUM(dt.present_water_usg) as total_usage,
        SUM(dt.total_water_amt) as total_amt
      FROM debt_trn dt
      JOIN proj_cus pc ON dt.cust_code = pc.custcode
      JOIN projects p ON p.contract_no != '' AND (
        pc.project_no_proj = p.contract_no OR pc.project_no_pipe = p.contract_no
      )
    `);
    const duration = Date.now() - start;
    console.log('Query finished in', duration, 'ms');
    console.log('Result:', result);
    process.exit(0);
  } catch (err) {
    console.error('Failed to run query:', err);
    process.exit(1);
  }
}

run();
