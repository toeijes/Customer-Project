const fs = require('fs');

// 1. Update App.jsx
const appPath = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let appCode = fs.readFileSync(appPath, 'utf8');

// Add availableBranches if not already present
if (!appCode.includes('const availableBranches = useMemo')) {
  appCode = appCode.replace(
    /const \[filterBranch, setFilterBranch\] = useState\('all'\);/,
    `const [filterBranch, setFilterBranch] = useState('all');

  const availableBranches = useMemo(() => {
    let list = branches;
    if (user?.role?.toLowerCase() !== 'admin' && user?.role?.toLowerCase() !== 'planning') {
      if (user?.area) {
        list = list.filter(b => String(b.zone) === String(user.area));
      }
    } else if (filterZone !== 'all') {
      list = list.filter(b => String(b.zone) === String(filterZone));
    }
    return list.filter(b => !b.branch_name.startsWith('การประปาส่วนภูมิภาคเขต'));
  }, [branches, filterZone, user]);`
  );
}

// Replace Zone and Branch Filter section in App.jsx
const oldFilterSectionRegex = /\{\/\* Zone Filter \(Only Admin\/Planning\) \*\/\}\s*[\s\S]*?\{\/\* Type Filter \*\/\}/;

const newFilterSection = `{/* Zone Filter (Only Admin/Planning) */}
          {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && (
            <div className="flex flex-col gap-1 w-48">
              <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">กปภ.เขต</label>
              <select 
                value={filterZone}
                onChange={(e) => { 
                  setFilterZone(e.target.value); 
                  setFilterBranch('all');
                  setCurrentPage(1); 
                }}
                className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
              >
                <option value="all">ทุกเขตทั่วประเทศ</option>
                {[1,2,3,4,5,6,7,8,9,10].map(z => <option key={z} value={z}>เขต {z}</option>)}
              </select>
            </div>
          )}

          {/* Branch Filter */}
          <div className="flex flex-col gap-1 w-48">
            <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">กปภ.สาขา</label>
            <select 
              value={filterBranch}
              onChange={(e) => { setFilterBranch(e.target.value); setCurrentPage(1); }}
              disabled={(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all'}
              className={\`border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm \${
                (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all'
                  ? 'bg-slate-100/80 text-slate-400 cursor-not-allowed border-slate-200'
                  : 'bg-white cursor-pointer'
              }\`}
            >
              <option value="all">
                {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all'
                  ? 'กรุณาเลือกเขตก่อน'
                  : (filterZone !== 'all' ? \`ทุกสาขา ในสังกัด เขต \${filterZone}\` : \`ทุกสาขา ในสังกัด เขต \${user?.area || '-'}\`)
                }
              </option>
              {availableBranches.map(b => (
                <option key={b.id || b.ba || b.branch_name} value={b.branch_name}>
                  {b.branch_name.replace(/^กปภ\.\s*สาขา\s*/, '').replace(/^สาขา\s*/, '').replace(/\s*\(ข\.\d+\)\s*/g, '')}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}`;

if (oldFilterSectionRegex.test(appCode)) {
  appCode = appCode.replace(oldFilterSectionRegex, newFilterSection);
  fs.writeFileSync(appPath, appCode);
  console.log('App.jsx dropdowns updated successfully');
} else {
  console.log('App.jsx filter section regex did not match!');
}

// 2. Update EarlyCustomersReport.jsx label
const earlyPath = 'd:/Antigravity/Customer Project/frontend/src/components/EarlyCustomersReport.jsx';
let earlyCode = fs.readFileSync(earlyPath, 'utf8');
earlyCode = earlyCode.replace(
  /<label className="block text-xs font-semibold text-slate-500 mb-1\.5 ml-1">เขต \(เขต \)<\/label>/g,
  '<label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">กปภ.เขต</label>'
);
fs.writeFileSync(earlyPath, earlyCode);
console.log('EarlyCustomersReport.jsx label fixed');
