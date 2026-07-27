const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add FileText to lucide-react
if (!code.includes('FileText')) {
  code = code.replace(/Trash2\s*\n\}\s*from\s*'lucide-react';/, "Trash2, FileText\n} from 'lucide-react';");
}

// 2. Add Component Imports
if (!code.includes('import ProjectSummaryReport')) {
  code = code.replace(
    /import AdminManagement from '\.\/components\/AdminManagement';/,
    "import AdminManagement from './components/AdminManagement';\nimport ProjectSummaryReport from './components/ProjectSummaryReport';\nimport EarlyCustomersReport from './components/EarlyCustomersReport';"
  );
}

// 3. Add Sidebar Menu
const sidebarMenu = `
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

if (!code.includes("reports_summary")) {
  code = code.replace(/\s*\{user\?\.role === 'admin' && \(/, sidebarMenu);
}

// 4. Add Render Block (This was already done by patch_render.cjs, but let's make sure it's there)
const renderBlock = `          {/* --- REPORTS --- */}
          {currentTab === 'reports_summary' && (
            <div className="space-y-4 animate-fadeIn">
              <ProjectSummaryReport branchesData={branches} user={user} />
            </div>
          )}
          {currentTab === 'reports_early_customers' && (
            <div className="space-y-4 animate-fadeIn">
              <EarlyCustomersReport projects={projects} monthlyData={monthlyData} branchesData={branches} user={user} />
            </div>
          )}

          {/* --- TAB 4: ADMIN MANAGEMENT --- */}`;

if (!code.includes("<ProjectSummaryReport branchesData={branches}")) {
  code = code.replace(/\s*\{\/\* --- TAB 4: ADMIN MANAGEMENT --- \*\/\}/, '\n' + renderBlock);
}

fs.writeFileSync(path, code);
console.log("Successfully patched App.jsx safely.");
