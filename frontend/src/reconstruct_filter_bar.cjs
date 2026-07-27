const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

const startStr = "{/* Filter Bar */}";
const endStr = "{/* Search Bar */}";

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const newFilterBar = `{/* Filter Bar */}
        {currentTab !== 'admin' && !currentTab.startsWith('reports') && (
          <div className="bg-pwa-blue-light/30 border-b border-pwa-blue-light/80 px-8 py-4 flex flex-wrap gap-4 items-center shrink-0">
            {/* Year Filter */}
            <div className="flex flex-col gap-1 w-44">
              <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">
                {(currentTab === 'monthly') ? 'ปีงบประมาณ' : 'โครงการประจำปีงบประมาณ'}
              </label>
              <select 
                value={filterYear}
                onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }}
                className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
              >
                <option value="all">ปีงบประมาณทั้งหมด</option>
                {FISCAL_YEARS.map(y => <option key={y} value={y}>พ.ศ. {y}</option>)}
              </select>
            </div>

            {/* Zone Filter (Admin/Planning only) */}
            {(user?.role === 'admin' || user?.role === 'planning') && (
              <div className="flex flex-col gap-1 w-32">
                <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">
                  กปภ.เขต
                </label>
                <select 
                  value={filterZone}
                  onChange={(e) => { setFilterZone(e.target.value); setFilterBranch('all'); setCurrentPage(1); }}
                  className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
                >
                  <option value="all">ทุกเขต</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(z => (
                    <option key={z} value={String(z)}>เขต {z}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Branch Filter */}
            <div className="flex flex-col gap-1 w-48">
              <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">กปภ.สาขา</label>
              <select 
                value={filterBranch}
                onChange={(e) => { setFilterBranch(e.target.value); setCurrentPage(1); }}
                disabled={(user?.role === 'admin' || user?.role === 'planning') && filterZone === 'all'}
                className={"border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm " + (((user?.role === 'admin' || user?.role === 'planning') && filterZone === 'all') ? 'bg-slate-100 cursor-not-allowed opacity-60' : 'cursor-pointer')}
              >
                <option value="all">
                  {(user?.role === 'admin' || user?.role === 'planning') 
                    ? (filterZone === 'all' ? 'กรุณาเลือกเขตก่อน' : \`ทุกสาขา ในสังกัด เขต \${filterZone}\`) 
                    : \`ทุกสาขา ในสังกัด เขต \${user?.area}\`}
                </option>
                {branches
                  .filter(b => {
                    if (user?.role === 'admin' || user?.role === 'planning') {
                      return filterZone === 'all' || String(b.zone) === String(filterZone);
                    } else {
                      return String(b.zone) === String(user?.area);
                    }
                  })
                  .map(b => <option key={b.id} value={b.branch_name}>กปภ.สาขา{b.branch_name}</option>)}
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex flex-col gap-1 w-64">
              <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">ประเภทโครงการขยายเขต</label>
              <select 
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
              >
                <option value="all">ประเภทโครงการทั้งหมด</option>
                {Object.entries(PROJECT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

          </div>
        )}

        `;

    code = code.substring(0, startIdx) + newFilterBar + code.substring(endIdx);
    fs.writeFileSync(path, code);
    console.log("Filter bar successfully reconstructed!");
} else {
    console.log("Could not find start/end of filter bar.");
}
