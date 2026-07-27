const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

const target1 = `  const monthlyBranchGrid = useMemo(() => {
    const grid = {};
    branches.forEach(b => {
      grid[b.branch_name] = {};
      MONTHS_TH.forEach(m => {
        grid[b.branch_name][m.num] = 0;
      });
    });

    const now = new Date();
    const curMonth = now.getMonth() + 1; // 1-12
    const curYearBE = now.getFullYear() + 543;
    const curFiscalYear = curMonth >= 10 ? curYearBE + 1 : curYearBE;
    const curFiscalIndex = curMonth >= 10 ? curMonth - 10 : curMonth + 2;

    monthlyData.forEach(item => {
      const matchesYear = filterYear === 'all' || item.fiscal_year === parseInt(filterYear);
      const matchesBranch = filterBranch === 'all' || item.branch_name === filterBranch;
      const matchesType = filterType === 'all' || item.project_type === parseInt(filterType);

      if (matchesYear && matchesBranch && matchesType) {
        // Exclude future months that haven't occurred yet
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
          if (grid[item.branch_name] && grid[item.branch_name][item.month_number] !== undefined) {
            grid[item.branch_name][item.month_number] += item.actual_users;
          }
        }
      }
    });

    return grid;
  }, [branches, monthlyData, filterYear, filterBranch, filterType]);`;

const repl1 = `  const monthlyBranchGrid = useMemo(() => {
    const isGlobalAndNoZone = (user?.role === 'admin' || user?.role === 'planning') && filterZone === 'all';
    const grid = {};
    
    if (isGlobalAndNoZone) {
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(z => {
        const key = \`เขต \${z}\`;
        grid[key] = {};
        MONTHS_TH.forEach(m => grid[key][m.num] = 0);
      });
    } else {
      branches.forEach(b => {
        grid[b.branch_name] = {};
        MONTHS_TH.forEach(m => grid[b.branch_name][m.num] = 0);
      });
    }

    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYearBE = now.getFullYear() + 543;
    const curFiscalYear = curMonth >= 10 ? curYearBE + 1 : curYearBE;
    const curFiscalIndex = curMonth >= 10 ? curMonth - 10 : curMonth + 2;

    monthlyData.forEach(item => {
      const matchesYear = filterYear === 'all' || item.fiscal_year === parseInt(filterYear);
      let matchesBranch = filterBranch === 'all' || item.branch_name === filterBranch;
      
      let targetKey = item.branch_name;
      if (isGlobalAndNoZone && filterBranch === 'all') {
         const branchInZone = branches.find(b => String(b.pwa_code) === String(item.pwa_code));
         if (branchInZone) {
           targetKey = \`เขต \${branchInZone.zone}\`;
         } else {
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
          if (grid[targetKey] && grid[targetKey][item.month_number] !== undefined) {
            grid[targetKey][item.month_number] += item.actual_users;
          }
        }
      }
    });

    return grid;
  }, [branches, monthlyData, filterYear, filterZone, filterBranch, filterType, user]);`;

const targetUI = `<table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-pwa-blue-dark border-b border-pwa-blue-dark text-xs text-white font-bold uppercase">
                        <th className="px-6 py-4 bg-pwa-blue-dark/95 font-bold font-display whitespace-nowrap text-white">กปภ.สาขา (เขต 6)</th>
                        {MONTHS_TH.map(m => (
                          <th key={m.num} className="px-4 py-4 text-center font-bold text-[11px] whitespace-nowrap text-blue-100">{m.name}</th>
                        ))}
                        <th className="px-6 py-4 text-right bg-pwa-blue-dark font-bold text-white whitespace-nowrap">ผลงานรวมจริง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {branches
                        .filter(branch => filterBranch === 'all' || branch.branch_name === filterBranch)
                        .map(branch => {
                          let branchTotal = 0;
                          return (
                            <tr key={branch.id} className="hover:bg-slate-50/50 transition">
                              <td className="px-6 py-4 font-bold text-slate-800 bg-slate-50/70 border-r border-slate-100 whitespace-nowrap">
                                กปภ.สาขา{branch.branch_name}
                              </td>
                              {MONTHS_TH.map(m => {
                                const actualVal = monthlyBranchGrid[branch.branch_name]?.[m.num] || 0;`;

const replUI = `<table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-pwa-blue-dark border-b border-pwa-blue-dark text-xs text-white font-bold uppercase">
                        <th className="px-6 py-4 bg-pwa-blue-dark/95 font-bold font-display whitespace-nowrap text-white">
                          {((user?.role === 'admin' || user?.role === 'planning') && filterZone === 'all') ? 'กปภ.เขต' : 'กปภ.สาขา'}
                        </th>
                        {MONTHS_TH.map(m => (
                          <th key={m.num} className="px-4 py-4 text-center font-bold text-[11px] whitespace-nowrap text-blue-100">{m.name}</th>
                        ))}
                        <th className="px-6 py-4 text-right bg-pwa-blue-dark font-bold text-white whitespace-nowrap">ผลงานรวมจริง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {(((user?.role === 'admin' || user?.role === 'planning') && filterZone === 'all') 
                        ? [1,2,3,4,5,6,7,8,9,10].map(z => ({ id: 'zone-'+z, key: \`เขต \${z}\`, name: \`กปภ.เขต \${z}\` }))
                        : branches.filter(branch => filterBranch === 'all' || branch.branch_name === filterBranch).map(b => ({ id: b.id, key: b.branch_name, name: \`กปภ.สาขา\${b.branch_name}\` })))
                        .map(row => {
                          let branchTotal = 0;
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/50 transition">
                              <td className="px-6 py-4 font-bold text-slate-800 bg-slate-50/70 border-r border-slate-100 whitespace-nowrap">
                                {row.name}
                              </td>
                              {MONTHS_TH.map(m => {
                                const actualVal = monthlyBranchGrid[row.key]?.[m.num] || 0;`;

if (code.includes('const monthlyBranchGrid = useMemo(() => {')) {
  code = code.replace(target1, repl1);
  code = code.replace(targetUI, replUI);
  fs.writeFileSync(path, code);
  console.log("Updated monthlyBranchGrid and its UI");
} else {
  console.log("Failed to find monthlyBranchGrid hooks/UI");
}
