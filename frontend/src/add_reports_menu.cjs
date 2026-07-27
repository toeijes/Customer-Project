const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// Chunk 1: Imports
code = code.replace(
  "PieChart, Droplets, Trash2\\n} from 'lucide-react';",
  "PieChart, Droplets, Trash2, FileText\\n} from 'lucide-react';"
);
if (!code.includes("import ProjectSummaryReport")) {
  code = code.replace(
    "import AdminManagement from './components/AdminManagement';",
    "import AdminManagement from './components/AdminManagement';\\nimport ProjectSummaryReport from './components/ProjectSummaryReport';\\nimport EarlyCustomersReport from './components/EarlyCustomersReport';"
  );
}

// Chunk 2: Sidebar menus
const sidebarTarget = `                <Droplets className="w-5 h-5" />
                ประเมินการใช้น้ำสะสม
              </button>

              {user?.role === 'admin' && (`;

const sidebarNew = `                <Droplets className="w-5 h-5" />
                ประเมินการใช้น้ำสะสม
              </button>

              <div className="pt-2 mt-2 border-t border-pwa-blue/20">
                <p className="px-4 text-[10px] font-bold text-pwa-blue-dark/50 uppercase tracking-wider mb-1 mt-1">รายงานเพิ่มเติม</p>
                
                <button 
                  onClick={() => { setCurrentTab('reports_summary'); resetFilters(); }}
                  className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm cursor-pointer \${
                    currentTab === 'reports_summary' 
                      ? 'bg-gradient-to-r from-pwa-blue to-pwa-blue/70 text-white border-l-4 border-pwa-cyan pl-3 shadow-md' 
                      : 'text-blue-100/80 hover:bg-pwa-blue/20 hover:text-white'
                  }\`}
                >
                  <FileText className="w-5 h-5" />
                  รายงานสรุปโครงการ
                </button>

                <button 
                  onClick={() => { setCurrentTab('reports_early_customers'); resetFilters(); }}
                  className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm cursor-pointer \${
                    currentTab === 'reports_early_customers' 
                      ? 'bg-gradient-to-r from-pwa-blue to-pwa-blue/70 text-white border-l-4 border-pwa-cyan pl-3 shadow-md' 
                      : 'text-blue-100/80 hover:bg-pwa-blue/20 hover:text-white'
                  }\`}
                >
                  <FileText className="w-5 h-5" />
                  ผู้ใช้น้ำที่มาใช้ก่อนกำหนด
                </button>
              </div>

              {user?.role === 'admin' && (`;

if (code.includes(sidebarTarget)) {
  code = code.replace(sidebarTarget, sidebarNew);
} else {
  console.log("Could not find sidebar target");
}

fs.writeFileSync(path, code);
console.log("Done");
