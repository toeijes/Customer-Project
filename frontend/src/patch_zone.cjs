const fs = require('fs');

const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add filterZone state
if (!code.includes("const [filterZone, setFilterZone]")) {
  code = code.replace(
    "const [filterYear, setFilterYear] = useState('all');\n  const [filterBranch, setFilterBranch] = useState('all');",
    "const [filterYear, setFilterYear] = useState('all');\n  const [filterZone, setFilterZone] = useState('all');\n  const [filterBranch, setFilterBranch] = useState('all');"
  );
}

// 2. Add filterZone to resetFilters
if (!code.includes("setFilterZone('all');")) {
  code = code.replace(
    "const resetFilters = () => {\n    setFilterYear('all');\n    setFilterBranch('all');",
    "const resetFilters = () => {\n    setFilterYear('all');\n    setFilterZone('all');\n    setFilterBranch('all');"
  );
}

// 3. Update filteredProjects logic
const filteredProjectsTarget = `  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesYear = filterYear === 'all' || p.completion_year === parseInt(filterYear);
      const matchesBranch = filterBranch === 'all' || p.branch_name === filterBranch;
      const matchesType = filterType === 'all' || p.project_type === parseInt(filterType);`;

const filteredProjectsReplacement = `  const filteredProjects = useMemo(() => {
    const hasGlobalView = user?.role === 'admin' || user?.role === 'planning';
    return projects.filter(p => {
      const matchesYear = filterYear === 'all' || p.completion_year === parseInt(filterYear);
      let matchesBranch = filterBranch === 'all' || p.branch_name === filterBranch;
      
      if (hasGlobalView && filterZone !== 'all' && filterBranch === 'all') {
        const branchInZone = branches.find(b => String(b.pwa_code) === String(p.pwa_code));
        matchesBranch = branchInZone && String(branchInZone.zone) === String(filterZone);
      } else if (!hasGlobalView && filterBranch === 'all') {
        const branchInZone = branches.find(b => String(b.pwa_code) === String(p.pwa_code));
        matchesBranch = branchInZone && String(branchInZone.zone) === String(user?.area);
      }

      const matchesType = filterType === 'all' || p.project_type === parseInt(filterType);`;

if (!code.includes("const hasGlobalView = user?.role === 'admin' || user?.role === 'planning';")) {
  code = code.replace(filteredProjectsTarget, filteredProjectsReplacement);
  code = code.replace(
    "}, [projects, filterYear, filterBranch, filterType, searchTerm]);",
    "}, [projects, filterYear, filterZone, filterBranch, filterType, searchTerm, branches, user]);"
  );
}

// 4. Update UI for Zone Filter
const uiTarget = `{/* Year Filter */}
          <div className="flex flex-col gap-1 w-44">`;

const uiReplacement = `{/* Zone Filter (Admin/Planning only) */}
          {(user?.role === 'admin' || user?.role === 'planning') && (
            <div className="flex flex-col gap-1 w-32">
              <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">
                กปภ.ข.
              </label>
              <select 
                value={filterZone}
                onChange={(e) => { setFilterZone(e.target.value); setFilterBranch('all'); setCurrentPage(1); }}
                className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
              >
                <option value="all">ทุกเขต</option>
                {[...new Set(branches.map(b => b.zone).filter(Boolean))].sort().map(z => (
                  <option key={z} value={z}>เขต {z}</option>
                ))}
              </select>
            </div>
          )}

          {/* Year Filter */}
          <div className="flex flex-col gap-1 w-44">`;

if (!code.includes("Zone Filter (Admin/Planning only)")) {
  code = code.replace(uiTarget, uiReplacement);
}

fs.writeFileSync(path, code);
console.log("Patched App.jsx to restore zone filter");
