const db = require('./db');

async function testLogic() {
  const monthlyData = await db.query(`
    SELECT m.*, p.contract_no, p.pwa_code 
    FROM monthly_actual_users m
    LEFT JOIN projects p ON m.project_code = p.project_code
    WHERE m.project_code NOT LIKE 'PWA6-%' AND m.project_type IN (1, 2, 3, 4)
  `);

  const branches = await db.query(`SELECT * FROM pwa_branches`);

  const filterZone = '6';
  const filterYear = '2568';
  const filterBranch = 'all';
  const filterType = 'all';
  const MONTHS_TH = [
    { name: 'ต.ค.', num: 10 }, { name: 'พ.ย.', num: 11 }, { name: 'ธ.ค.', num: 12 },
    { name: 'ม.ค.', num: 1 }, { name: 'ก.พ.', num: 2 }, { name: 'มี.ค.', num: 3 },
    { name: 'เม.ย.', num: 4 }, { name: 'พ.ค.', num: 5 }, { name: 'มิ.ย.', num: 6 },
    { name: 'ก.ค.', num: 7 }, { name: 'ส.ค.', num: 8 }, { name: 'ก.ย.', num: 9 }
  ];

  const grid = {};
  const relevantBranches = branches.filter(b => String(b.zone) === String(filterZone));
  relevantBranches.forEach(b => {
    grid[b.pwa_code] = {};
    MONTHS_TH.forEach(m => { grid[b.pwa_code][m.num] = 0; });
  });

  const curFiscalYear = 2569;
  const curFiscalIndex = 9; // July -> 9

  let processedCount = 0;

  for (let item of monthlyData) {
    if (String(item.pwa_code) === '5521011' && String(item.fiscal_year) === '2568') {
      console.log('--- Checking item for Khon Kaen 2568 month', item.month_number, '---');
      
      const matchesYear = filterYear === 'all' || item.fiscal_year === parseInt(filterYear);
      console.log('matchesYear:', matchesYear);

      let matchesBranch = filterBranch === 'all' || String(item.pwa_code) === String(filterBranch);
      if (filterZone !== 'all') {
        const branchInZone = branches.find(b => String(b.pwa_code) === String(item.pwa_code));
        if (!branchInZone || String(branchInZone.zone) !== String(filterZone)) {
          matchesBranch = false;
        }
      }
      console.log('matchesBranch:', matchesBranch);

      const matchesType = filterType === 'all' || item.project_type === parseInt(filterType);
      console.log('matchesType:', matchesType);

      if (matchesYear && matchesBranch && matchesType) {
        let isFuture = false;
        if (item.fiscal_year > curFiscalYear) {
          isFuture = true;
        } else if (item.fiscal_year === curFiscalYear) {
          const itemFiscalIndex = item.month_number >= 10 ? item.month_number - 10 : item.month_number + 2;
          if (itemFiscalIndex > curFiscalIndex) {
            isFuture = true;
          }
        }
        console.log('isFuture:', isFuture);

        if (!isFuture) {
          console.log('Has grid?', !!grid[item.pwa_code], grid[item.pwa_code]);
          console.log('Has month in grid?', grid[item.pwa_code] && grid[item.pwa_code][item.month_number] !== undefined);
          
          if (grid[item.pwa_code] && grid[item.pwa_code][item.month_number] !== undefined) {
            grid[item.pwa_code][item.month_number] += parseInt(item.actual_users) || 0;
            processedCount++;
          }
        }
      }
      break; // Only test first one
    }
  }
}

testLogic().finally(() => process.exit());
