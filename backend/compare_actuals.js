const db = require('./db');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('--- Generating actual users summary by project ---');
    const results = await db.query(`
      SELECT 
        p.project_code, 
        p.contract_no, 
        p.project_name,
        SUM(yp.actual_users) as total_actual_users
      FROM projects p
      LEFT JOIN project_yearly_performance yp ON p.project_code = yp.project_code
      WHERE p.project_code NOT LIKE 'PWA6-%' AND p.project_type IN (1, 2, 3, 4)
      GROUP BY p.project_code, p.contract_no, p.project_name
      ORDER BY p.project_code ASC
    `);

    let totalSum = 0;
    const reportData = results.map(r => {
      const actuals = parseInt(r.total_actual_users || 0);
      totalSum += actuals;
      return {
        project_code: r.project_code,
        contract_no: r.contract_no || '',
        project_name: r.project_name,
        actual_users: actuals
      };
    });

    console.log(`\n✓ Total Projects: ${reportData.length}`);
    console.log(`✓ SUM of all actual users: ${totalSum}`);

    const outputFilename = 'actuals_summary.json';
    fs.writeFileSync(path.join(__dirname, outputFilename), JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`✓ Detailed report saved to backend/${outputFilename}`);
    console.log('\nInstructions:');
    console.log('1. Run this script on BOTH local and server.');
    console.log('2. Compare the generated actuals_summary.json files to see which project code(s) have different actual_users.');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
