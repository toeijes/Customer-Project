const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `  const branchChartData = useMemo(() => {
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

const replacementStr = `  const branchChartData = useMemo(() => {
    const isGlobalAndNoZone = (user?.role === 'admin' || user?.role === 'planning') && filterZone === 'all';
    
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
        // filter branchMap down to only what is needed? No, let the filteredProjects just populate it.
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
  }, [branches, filteredProjects, filterZone, user]);`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync(path, code);
  console.log("Updated branchChartData");
} else {
  console.log("Could not find branchChartData block.");
}
