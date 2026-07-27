const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add filterZone and isGlobalAndNoZone to state
if (!code.includes("const [filterZone, setFilterZone] = useState('all');")) {
  code = code.replace(
    /const \[filterYear,\s*setFilterYear\]\s*=\s*useState\('all'\);/g,
    "const [filterYear, setFilterYear] = useState('all');\n  const [filterZone, setFilterZone] = useState('all');\n  const isGlobalAndNoZone = (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all';"
  );
}

// 2. Add filterZone to resetFilters
if (!code.includes("setFilterZone('all');")) {
  code = code.replace(
    /setFilterYear\('all'\);/g,
    "setFilterYear('all');\n    setFilterZone('all');"
  );
}

// 3. Update UI Filter Bar using Regex to avoid blank line issues
const filterBarRegex = /<select[\s\S]*?value=\{filterYear\}[\s\S]*?<\/select>\s*<\/div>\s*\{\/\* Branch Filter \*\/\}\s*<div className="flex flex-col gap-1 w-48">\s*<label className="text-\[11px\] font-extrabold text-pwa-blue-dark\/85 uppercase tracking-wider">กปภ\.สาขา<\/label>\s*<select[\s\S]*?value=\{filterBranch\}/;

const replacementFilterBar = `<select 
              value={filterYear}
              onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }}
              className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
            >
              <option value="all">ปีงบประมาณทั้งหมด</option>
              {FISCAL_YEARS.map(y => <option key={y} value={y}>พ.ศ. {y}</option>)}
            </select>
          </div>

          {/* Zone Filter (Only Admin/Planning) */}
          {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && (
            <div className="flex flex-col gap-1 w-48">
              <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">กปภ.เขต</label>
              <select 
                value={filterZone}
                onChange={(e) => { 
                  setFilterZone(e.target.value); 
                  if (e.target.value === 'all') setFilterBranch('all');
                  setCurrentPage(1); 
                }}
                className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
              >
                <option value="all">ทุกเขตทั่วประเทศ</option>
                {[1,2,3,4,5,6,7,8,9,10].map(z => <option key={z} value={z}>กปภ.เขต {z}</option>)}
              </select>
            </div>
          )}

          {/* Branch Filter */}
          <div className="flex flex-col gap-1 w-48">
            <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">กปภ.สาขา</label>
            <select 
              value={filterBranch}`;

if (!code.includes("ทุกเขตทั่วประเทศ") && filterBarRegex.test(code)) {
  code = code.replace(filterBarRegex, replacementFilterBar);
}

// 4. Update branchChartData
const chartRegex = /const branchChartData = useMemo\(\(\) => \{[\s\S]*?return Object\.values\(branchMap\);\s*\}, \[branches, filteredProjects\]\);/;

const replacementChart = `const branchChartData = useMemo(() => {
    if (isGlobalAndNoZone) {
      const zoneMap = {};
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(z => {
        zoneMap[z] = { name: \`เขต \${z}\`, เป้าหมาย: 0, ผลงานจริง: 0, _isZone: true };
      });
      filteredProjects.forEach(p => {
        const branchInfo = branches.find(b => b.branch_name === p.branch_name);
        const z = branchInfo ? branchInfo.zone : null;
        if (z && zoneMap[z]) {
          zoneMap[z].เป้าหมาย += parseInt(p.target_users || 0);
          zoneMap[z].ผลงานจริง += parseInt(p.total_actual_users || 0);
        }
      });
      return Object.values(zoneMap);
    } else {
      const branchMap = {};
      branches.forEach(b => {
        branchMap[b.branch_name] = { name: b.branch_name, เป้าหมาย: 0, ผลงานจริง: 0 };
      });
      filteredProjects.forEach(p => {
        if (branchMap[p.branch_name]) {
          branchMap[p.branch_name].เป้าหมาย += parseInt(p.target_users || 0);
          branchMap[p.branch_name].ผลงานจริง += parseInt(p.total_actual_users || 0);
        }
      });
      return Object.values(branchMap);
    }
  }, [branches, filteredProjects, isGlobalAndNoZone]);`;

if (chartRegex.test(code)) {
  code = code.replace(chartRegex, replacementChart);
}

// 5. Update monthlyBranchGrid
const monthlyRegex = /const monthlyBranchGrid = useMemo\(\(\) => \{[\s\S]*?const grid = \{\};[\s\S]*?branches\.forEach\(b => \{[\s\S]*?grid\[b\.branch_name\] = \{\};[\s\S]*?MONTHS_TH\.forEach\(m => \{[\s\S]*?grid\[b\.branch_name\]\[m\.num\] = 0;[\s\S]*?\}\);[\s\S]*?\}\);/;

const replacementMonthly = `const monthlyBranchGrid = useMemo(() => {
    const grid = {};
    if (isGlobalAndNoZone) {
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(z => {
        grid[\`เขต \${z}\`] = {};
        MONTHS_TH.forEach(m => {
          grid[\`เขต \${z}\`][m.num] = 0;
        });
      });
    } else {
      branches.forEach(b => {
        grid[b.branch_name] = {};
        MONTHS_TH.forEach(m => {
          grid[b.branch_name][m.num] = 0;
        });
      });
    }`;

if (monthlyRegex.test(code)) {
  code = code.replace(monthlyRegex, replacementMonthly);
  
  // Update inner logic
  const innerRegex = /if \(!isFuture\) \{\s*if \(grid\[item\.branch_name\] && grid\[item\.branch_name\]\[item\.month_number\] !== undefined\) \{\s*grid\[item\.branch_name\]\[item\.month_number\] \+= item\.actual_users;\s*\}\s*\}/;
        
  const innerReplacement = `if (!isFuture) {
          if (isGlobalAndNoZone) {
            const bInfo = branches.find(b => b.branch_name === item.branch_name);
            if (bInfo) {
              const zKey = \`เขต \${bInfo.zone}\`;
              if (grid[zKey] && grid[zKey][item.month_number] !== undefined) {
                grid[zKey][item.month_number] += item.actual_users;
              }
            }
          } else {
            if (grid[item.branch_name] && grid[item.branch_name][item.month_number] !== undefined) {
              grid[item.branch_name][item.month_number] += item.actual_users;
            }
          }
        }`;
  code = code.replace(innerRegex, innerReplacement);
  
  // Update dependencies
  code = code.replace(
    /}, \[monthlyData, branches, filterYear, filterBranch, filterType\]\);/g,
    "}, [monthlyData, branches, filterYear, filterBranch, filterType, isGlobalAndNoZone]);"
  );
}

// 6. Fix Branch Dropdown message (so that ONLY admin gets ทุกสาขาทั่วประเทศ)
// When isGlobalAndNoZone is defined, we can just use the dropdown message appropriately
code = code.replace(
  /<option value="all">\s*\{.*\}\s*<\/option>/,
  "<option value=\"all\">\n                {user?.role?.toLowerCase() === 'admin' ? (filterZone === 'all' ? 'กรุณาเลือกเขตก่อน' : `ทุกสาขา ในสังกัด เขต ${filterZone}`) : `ทุกสาขา ในสังกัด เขต ${user?.area || '-'}`}\n              </option>"
);

// 7. Fix the 502 parsing bug from before
code = code.replace(
  /\.then\(res => res\.json\(\)\)\s*\.then\(data => \{/g,
  ".then(res => {\n        if (!res.ok) throw new Error('API Error');\n        return res.json();\n      })\n      .then(data => {"
);

fs.writeFileSync(path, code);
console.log("Successfully patched App.jsx for Zone Aggregation");
