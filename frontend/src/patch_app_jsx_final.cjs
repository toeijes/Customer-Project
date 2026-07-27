const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add isGlobalAndNoZone properly after filterType
const stateBlock = `  const [filterYear, setFilterYear] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterType, setFilterType] = useState('all');`;

const stateBlockFixed = `  const [filterYear, setFilterYear] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const isGlobalAndNoZone = (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all';`;

code = code.replace(stateBlock, stateBlockFixed);

// 2. Fix branchChartData
const chartTarget = `  const branchChartData = useMemo(() => {
    const branchMap = {};
    branches.forEach(b => {
      branchMap[b.branch_name] = { name: b.branch_name, เป้าหมาย: 0, ผลงานจริง: 0 };
    });

    filteredProjects.forEach(p => {
      if (branchMap[p.branch_name]) {
        branchMap[p.branch_name].เป้าหมาย += parseInt(p.target_users);
        branchMap[p.branch_name].ผลงานจริง += parseInt(p.total_actual_users || 0);
      }
    });

    return Object.values(branchMap);
  }, [branches, filteredProjects]);`;

const chartFixed = `  const branchChartData = useMemo(() => {
    if (isGlobalAndNoZone) {
      const zoneMap = {};
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(z => {
        zoneMap[z] = { name: \`เขต \${z}\`, เป้าหมาย: 0, ผลงานจริง: 0, _isZone: true };
      });
      
      filteredProjects.forEach(p => {
        const branchInZone = branches.find(b => String(b.pwa_code) === String(p.pwa_code));
        if (branchInZone && zoneMap[branchInZone.zone]) {
          zoneMap[branchInZone.zone].เป้าหมาย += parseInt(p.target_users || 0);
          zoneMap[branchInZone.zone].ผลงานจริง += parseInt(p.total_actual_users || 0);
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
          branchMap[p.branch_name].เป้าหมาย += parseInt(p.target_users);
          branchMap[p.branch_name].ผลงานจริง += parseInt(p.total_actual_users || 0);
        }
      });

      return Object.values(branchMap);
    }
  }, [branches, filteredProjects, isGlobalAndNoZone]);`;

code = code.replace(chartTarget, chartFixed);

// 3. Add processedWaterUsageBranches
const waterUsageTotalTarget = `  const waterUsageTotalPages = useMemo(() => {`;
const waterUsageTotalFixed = `  const processedWaterUsageBranches = useMemo(() => {
    if (!waterUsageData || !waterUsageData.branches) return [];
    if (isGlobalAndNoZone) {
      const zoneMap = {};
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(z => {
        zoneMap[z] = { branch_name: \`เขต \${z}\`, total_usage: 0, total_amount: 0, _isZone: true };
      });
      waterUsageData.branches.forEach(wb => {
        const branchInfo = branches.find(b => b.branch_name === wb.branch_name);
        if (branchInfo && zoneMap[branchInfo.zone]) {
          zoneMap[branchInfo.zone].total_usage += Number(wb.total_usage || 0);
          zoneMap[branchInfo.zone].total_amount += Number(wb.total_amount || 0);
        }
      });
      return Object.values(zoneMap);
    }
    return waterUsageData.branches;
  }, [waterUsageData, branches, isGlobalAndNoZone]);

  const waterUsageTotalPages = useMemo(() => {`;

code = code.replace(waterUsageTotalTarget, waterUsageTotalFixed);

// 4. Update BarChart for water usage
code = code.replace("<BarChart data={waterUsageData.branches}", "<BarChart data={processedWaterUsageBranches}");

// 5. Update Matrix Grid Table
const matrixTarget = `<table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-pwa-blue-dark border-b border-pwa-blue-dark text-xs text-white font-bold uppercase">
                        <th className="px-6 py-4 bg-pwa-blue-dark/95 font-bold font-display whitespace-nowrap text-white">กปภ.สาขา (เขต 6)</th>`;

const matrixFixed = `<table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-pwa-blue-dark border-b border-pwa-blue-dark text-xs text-white font-bold uppercase">
                        <th className="px-6 py-4 bg-pwa-blue-dark/95 font-bold font-display whitespace-nowrap text-white">
                          {isGlobalAndNoZone ? 'กปภ.เขต' : (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning' ? (filterZone === 'all' ? 'กปภ.สาขา' : \`กปภ.สาขา (เขต \${filterZone})\`) : \`กปภ.สาขา (เขต \${user?.area})\`)}
                        </th>`;

code = code.replace(matrixTarget, matrixFixed);

const matrixBodyTarget = `                    <tbody className="divide-y divide-slate-100 text-sm">
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
                                const actualVal = monthlyBranchGrid[branch.branch_name]?.[m.num] || 0;
                                branchTotal += actualVal;
                                
                                let bgClass = 'bg-transparent';
                                let textClass = 'text-slate-400 font-normal';
                                if (actualVal > 25) {
                                  bgClass = 'bg-pwa-blue';
                                  textClass = 'text-white font-extrabold';
                                } else if (actualVal > 15) {
                                  bgClass = 'bg-pwa-cyan/25';
                                  textClass = 'text-pwa-blue-dark font-bold';
                                } else if (actualVal > 5) {
                                  bgClass = 'bg-pwa-cyan-light';
                                  textClass = 'text-pwa-blue-dark font-semibold';
                                } else if (actualVal > 0) {
                                  bgClass = 'bg-blue-50/50';
                                  textClass = 'text-slate-600';
                                }

                                return (
                                  <td key={m.num} className={\`px-4 py-4 text-center \${bgClass} \${textClass} transition-colors\`}>
                                    {actualVal > 0 ? actualVal : '-'}
                                  </td>
                                );
                              })}
                              <td className="px-6 py-4 text-right font-black text-pwa-blue-dark bg-slate-50/50 whitespace-nowrap">
                                {branchTotal}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>`;

const matrixBodyFixed = `                    <tbody className="divide-y divide-slate-100 text-sm">
                      {isGlobalAndNoZone ? (
                        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(z => {
                          let zoneTotal = 0;
                          return (
                            <tr key={\`zone-\${z}\`} className="hover:bg-slate-50/50 transition">
                              <td className="px-6 py-4 font-bold text-slate-800 bg-slate-50/70 border-r border-slate-100 whitespace-nowrap">
                                กปภ.เขต {z}
                              </td>
                              {MONTHS_TH.map(m => {
                                let actualVal = 0;
                                branches.filter(b => String(b.zone) === String(z)).forEach(b => {
                                  actualVal += monthlyBranchGrid[b.branch_name]?.[m.num] || 0;
                                });
                                zoneTotal += actualVal;
                                
                                let bgClass = 'bg-transparent';
                                let textClass = 'text-slate-400 font-normal';
                                if (actualVal > 25) {
                                  bgClass = 'bg-pwa-blue';
                                  textClass = 'text-white font-extrabold';
                                } else if (actualVal > 15) {
                                  bgClass = 'bg-pwa-cyan/25';
                                  textClass = 'text-pwa-blue-dark font-bold';
                                } else if (actualVal > 5) {
                                  bgClass = 'bg-pwa-cyan-light';
                                  textClass = 'text-pwa-blue-dark font-semibold';
                                } else if (actualVal > 0) {
                                  bgClass = 'bg-blue-50/50';
                                  textClass = 'text-slate-600';
                                }

                                return (
                                  <td key={m.num} className={\`px-4 py-4 text-center \${bgClass} \${textClass} transition-colors\`}>
                                    {actualVal > 0 ? actualVal : '-'}
                                  </td>
                                );
                              })}
                              <td className="px-6 py-4 text-right font-black text-pwa-blue-dark bg-slate-50/50 whitespace-nowrap">
                                {zoneTotal}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        branches
                          .filter(branch => filterBranch === 'all' || branch.branch_name === filterBranch)
                          .map(branch => {
                            let branchTotal = 0;
                            return (
                              <tr key={branch.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4 font-bold text-slate-800 bg-slate-50/70 border-r border-slate-100 whitespace-nowrap">
                                  กปภ.สาขา{branch.branch_name}
                                </td>
                                {MONTHS_TH.map(m => {
                                  const actualVal = monthlyBranchGrid[branch.branch_name]?.[m.num] || 0;
                                  branchTotal += actualVal;
                                  
                                  let bgClass = 'bg-transparent';
                                  let textClass = 'text-slate-400 font-normal';
                                  if (actualVal > 25) {
                                    bgClass = 'bg-pwa-blue';
                                    textClass = 'text-white font-extrabold';
                                  } else if (actualVal > 15) {
                                    bgClass = 'bg-pwa-cyan/25';
                                    textClass = 'text-pwa-blue-dark font-bold';
                                  } else if (actualVal > 5) {
                                    bgClass = 'bg-pwa-cyan-light';
                                    textClass = 'text-pwa-blue-dark font-semibold';
                                  } else if (actualVal > 0) {
                                    bgClass = 'bg-blue-50/50';
                                    textClass = 'text-slate-600';
                                  }

                                  return (
                                    <td key={m.num} className={\`px-4 py-4 text-center \${bgClass} \${textClass} transition-colors\`}>
                                      {actualVal > 0 ? actualVal : '-'}
                                    </td>
                                  );
                                })}
                                <td className="px-6 py-4 text-right font-black text-pwa-blue-dark bg-slate-50/50 whitespace-nowrap">
                                  {branchTotal}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>`;

code = code.replace(matrixBodyTarget, matrixBodyFixed);

// 6. Fix Branch Dropdown title string "ทุกสาขา ในสังกัด เขต 6"
const branchTitleTarget = `<option value="all">ทุกสาขา ในสังกัด เขต 6</option>`;
const branchTitleFixed = `<option value="all">
                {isGlobalAndNoZone 
                  ? (filterZone === 'all' ? 'กรุณาเลือกเขตก่อน' : \`ทุกสาขา ในสังกัด เขต \${filterZone}\`) 
                  : (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning' ? (filterZone === 'all' ? 'ทุกสาขาทั่วประเทศ' : \`ทุกสาขา ในสังกัด เขต \${filterZone}\`) : \`ทุกสาขา ในสังกัด เขต \${user?.area}\`)
                }
              </option>`;

code = code.replace(branchTitleTarget, branchTitleFixed);

// 7. Fix Filter Branch Select state disabled class
const filterBranchTarget = `<select 
              value={filterBranch}
              onChange={(e) => {
                setFilterBranch(e.target.value);
                setSearchTerm('');
              }}
              className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
            >`;

const filterBranchFixed = `<select 
              value={filterBranch}
              onChange={(e) => {
                setFilterBranch(e.target.value);
                setSearchTerm('');
              }}
              disabled={isGlobalAndNoZone}
              className={\`border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm \${isGlobalAndNoZone ? 'bg-slate-100 cursor-not-allowed opacity-60' : 'cursor-pointer'}\`}
            >`;

code = code.replace(filterBranchTarget, filterBranchFixed);

fs.writeFileSync(path, code);
console.log('App.jsx has been completely patched');
