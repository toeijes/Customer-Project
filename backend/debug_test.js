const db = require('./db');

async function testLogic() {
  const [monthlyData] = await db.query(`
    SELECT m.*, p.contract_no, p.pwa_code 
    FROM monthly_actual_users m
    LEFT JOIN projects p ON m.project_code = p.project_code
    WHERE m.project_code NOT LIKE 'PWA6-%' AND m.project_type IN (1, 2, 3, 4)
  `);

  const [branches] = await db.query(`SELECT * FROM pwa_branches`);

  const filterZone = '6';
  const filterYear = 2568;
  
  for (let item of monthlyData) {
    if (String(item.pwa_code) === '5521011' && item.fiscal_year === filterYear) {
      console.log('Found Khon Kaen 2568:', item.month_number, item.actual_users);
      
      const branchInZone = branches.find(b => String(b.pwa_code) === String(item.pwa_code));
      console.log('branchInZone:', !!branchInZone, branchInZone ? branchInZone.zone : 'N/A');
    }
  }
}

testLogic().finally(() => process.exit());
