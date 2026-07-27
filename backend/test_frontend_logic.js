const db = require('./db');

async function testLogic() {
  const [monthlyData] = await db.query(`
    SELECT m.*, p.contract_no, p.pwa_code 
    FROM monthly_actual_users m
    LEFT JOIN projects p ON m.project_code = p.project_code
    WHERE m.project_code NOT LIKE 'PWA6-%' AND m.project_type IN (1, 2, 3, 4)
  `);

  const [branches] = await db.query(`SELECT * FROM pwa_branches`);

  const MONTHS_TH = [
    { name: 'ต.ค.', num: 10 }, { name: 'พ.ย.', num: 11 }, { name: 'ธ.ค.', num: 12 },
    { name: 'ม.ค.', num: 1 }, { name: 'ก.พ.', num: 2 }, { name: 'มี.ค.', num: 3 },
    { name: 'เม.ย.', num: 4 }, { name: 'พ.ค.', num: 5 }, { name: 'มิ.ย.', num: 6 },
    { name: 'ก.ค.', num: 7 }, { name: 'ส.ค.', num: 8 }, { name: 'ก.ย.', num: 9 }
  ];

  const filterZone = '6'; // Or 7
  const filterBranch = 'all';
  const filterYear = '2568';
  const filterType = 'all';

  const grid = {};
  const relevantBranches = branches.filter(b => String(b.zone) === String(filterZone));
  relevantBranches.forEach(b => {
    grid[b.pwa_code] = {};
    MONTHS_TH.forEach(m => { grid[b.pwa_code][m.num] = 0; });
  });

  const curFiscalYear = 2569;
  const curFiscalIndex = 9; // July -> 9

  let processedCount = 0;

  monthlyData.forEach(item => {
    const matchesYear = filterYear === 'all' || item.fiscal_year === parseInt(filterYear);
    let matchesBranch = filterBranch === 'all' || String(item.pwa_code) === String(filterBranch);
    if (filterZone !== 'all') {
      const branchInZone = branches.find(b => String(b.pwa_code) === String(item.pwa_code));
      if (!branchInZone || String(branchInZone.zone) !== String(filterZone)) {
        matchesBranch = false;
      }
    }
    const matchesType = filterType === 'all' || item.project_type === parseInt(filterType);

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

      if (!isFuture) {
        if (grid[item.pwa_code] && grid[item.pwa_code][item.month_number] !== undefined) {
          grid[item.pwa_code][item.month_number] += parseInt(item.actual_users) || 0;
          processedCount++;
        }
      }
    }
  });

  console.log('Processed Count for Zone', filterZone, 'Year', filterYear, ':', processedCount);
  console.log('Grid for 5521011 (Khon Kaen):', grid['5521011']);
}

testLogic().finally(() => process.exit());
