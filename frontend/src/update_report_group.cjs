const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/components/ProjectSummaryReport.jsx';
let code = fs.readFileSync(path, 'utf8');

const targetGroup = `    // Group by branch
    const grouped = {};
    enriched.forEach(p => {
      if (!grouped[p.branch_name]) grouped[p.branch_name] = [];
      grouped[p.branch_name].push(p);
    });`;

const replGroup = `    // Group by branch or zone
    const isGlobalAndNoZone = (user?.role === 'admin' || user?.role === 'planning') && filterZone === 'all';
    const grouped = {};
    enriched.forEach(p => {
      let key = p.branch_name;
      if (isGlobalAndNoZone) {
        const branchInZone = availableBranches.find(b => String(b.pwa_code) === String(p.pwa_code));
        if (branchInZone) {
          key = \`กปภ.เขต \${branchInZone.zone}\`;
        }
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });`;

code = code.replace(targetGroup, replGroup);

const targetLabel = `<label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">เขต (เขต )</label>`;
const replLabel = `<label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">กปภ.เขต</label>`;

code = code.replace(targetLabel, replLabel);

fs.writeFileSync(path, code);
console.log("Patched ProjectSummaryReport.jsx");
