const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Move isGlobalAndNoZone to the component root
const isGlobalStr = "const isGlobalAndNoZone = (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all';";
code = code.replace(isGlobalStr, ""); // Remove it from branchChartData

const insertGlobalIdx = code.indexOf("const [filterYear, setFilterYear] = useState('all');");
code = code.substring(0, insertGlobalIdx) + 
  "const isGlobalAndNoZone = (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all';\n  " + 
  code.substring(insertGlobalIdx);

// 2. Add processedWaterUsageBranches for the second graph
const insertProcessedWaterIdx = code.indexOf("const waterUsageTotalPages = useMemo(() => {");
const processedWaterUsageCode = `
  const processedWaterUsageBranches = useMemo(() => {
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

  `;
code = code.substring(0, insertProcessedWaterIdx) + processedWaterUsageCode + code.substring(insertProcessedWaterIdx);

// 3. Update the BarChart data prop
code = code.replace("<BarChart data={waterUsageData.branches}", "<BarChart data={processedWaterUsageBranches}");

// 4. Update the Matrix Grid UI
const matrixTableStart = code.indexOf('<table className="w-full text-left border-collapse">');
const matrixTableEnd = code.indexOf('</table>', matrixTableStart) + '</table>'.length;
const oldMatrixTable = code.substring(matrixTableStart, matrixTableEnd);

const newMatrixTable = `<table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-pwa-blue-dark border-b border-pwa-blue-dark text-xs text-white font-bold uppercase">
                        <th className="px-6 py-4 bg-pwa-blue-dark/95 font-bold font-display whitespace-nowrap text-white">
                          {isGlobalAndNoZone ? 'กปภ.เขต' : (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning' ? (filterZone === 'all' ? 'กปภ.สาขา' : \`กปภ.สาขา (เขต \${filterZone})\`) : \`กปภ.สาขา (เขต \${user?.area})\`)}
                        </th>
                        {MONTHS_TH.map(m => (
                          <th key={m.num} className="px-4 py-4 text-center font-bold text-[11px] whitespace-nowrap text-blue-100">{m.name}</th>
                        ))}
                        <th className="px-6 py-4 text-right bg-pwa-blue-dark font-bold text-white whitespace-nowrap">ผลงานรวมจริง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
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
                    </tbody>
                  </table>`;

code = code.replace(oldMatrixTable, newMatrixTable);

fs.writeFileSync(path, code);
console.log('Fixed graphs and tables for zone view');
