const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/components/EarlyCustomersReport.jsx';
let code = fs.readFileSync(path, 'utf8');

const targetLabel = `<label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">เขต (เขต )</label>`;
const replLabel = `<label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">กปภ.เขต</label>`;
code = code.replace(targetLabel, replLabel);

const targetSelect = `<select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-pwa-blue focus:ring-2 focus:ring-pwa-blue/20 transition-all font-medium text-slate-700 shadow-sm outline-none"
            >
              <option value="all">ทุกสาขา</option>`;

const replSelect = `<select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              disabled={user?.role === 'admin' && filterZone === 'all'}
              className={\`w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:border-pwa-blue focus:ring-2 focus:ring-pwa-blue/20 transition-all font-medium text-slate-700 shadow-sm outline-none \${(user?.role === 'admin' && filterZone === 'all') ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'bg-white'}\`}
            >
              <option value="all">{(user?.role === 'admin' && filterZone === 'all') ? 'กรุณาเลือกเขตก่อน' : 'ทุกสาขา'}</option>`;

if (code.includes('เขต (เขต )')) {
  code = code.replace(targetSelect, replSelect);
  fs.writeFileSync(path, code);
  console.log("Patched EarlyCustomersReport.jsx");
} else {
  console.log("EarlyCustomersReport already patched or not found.");
}
