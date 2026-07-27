const fs = require('fs');

const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add imports
const imports = `import ProjectSummaryReport from './components/ProjectSummaryReport';\nimport EarlyCustomersReport from './components/EarlyCustomersReport';`;
if (!code.includes("import EarlyCustomersReport")) {
    code = code.replace(
        "import AdminManagement from './components/AdminManagement';",
        "import AdminManagement from './components/AdminManagement';\n" + imports
    );
}

// 2. Add State for the dropdown menu
if (!code.includes("const [isReportsMenuOpen")) {
    code = code.replace(
        "const [isSidebarOpen, setIsSidebarOpen] = useState(true);",
        "const [isSidebarOpen, setIsSidebarOpen] = useState(true);\n  const [isReportsMenuOpen, setIsReportsMenuOpen] = useState(false);"
    );
}

// 3. Add Sidebar menu item
const sidebarItemTarget = `{user?.role === 'admin' && (`;

const sidebarItemNew = `{/* Report Menu */}
              <div className="pt-2 mt-2 border-t border-pwa-blue/20">
                <button
                  onClick={() => setIsReportsMenuOpen(!isReportsMenuOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm cursor-pointer text-blue-100/80 hover:bg-pwa-blue/20 hover:text-white"
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5" />
                    รายงานสรุปผล
                  </div>
                  <ChevronDown className={\`w-4 h-4 transition-transform duration-200 \${isReportsMenuOpen ? 'rotate-180' : ''}\`} />
                </button>
                
                {isReportsMenuOpen && (
                  <div className="mt-1 pl-4 space-y-1">
                    <button
                      onClick={() => { setCurrentTab('reports_summary'); resetFilters(); }}
                      className={\`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition duration-200 text-left font-semibold text-[13px] cursor-pointer \${
                        currentTab === 'reports_summary'
                          ? 'bg-pwa-blue/50 text-white shadow-sm'
                          : 'text-blue-200 hover:bg-pwa-blue/20 hover:text-white'
                      }\`}
                    >
                      <div className={\`w-1.5 h-1.5 rounded-full \${currentTab === 'reports_summary' ? 'bg-pwa-cyan' : 'bg-blue-400'}\`} />
                      สรุปรายโครงการ
                    </button>
                    <button
                      onClick={() => { setCurrentTab('reports_early_customers'); resetFilters(); }}
                      className={\`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition duration-200 text-left font-semibold text-[13px] cursor-pointer \${
                        currentTab === 'reports_early_customers'
                          ? 'bg-pwa-blue/50 text-white shadow-sm'
                          : 'text-blue-200 hover:bg-pwa-blue/20 hover:text-white'
                      }\`}
                    >
                      <div className={\`w-1.5 h-1.5 rounded-full \${currentTab === 'reports_early_customers' ? 'bg-pwa-cyan' : 'bg-blue-400'}\`} />
                      ลูกค้าก่อนโครงการเสร็จ
                    </button>
                  </div>
                )}
              </div>

              ${sidebarItemTarget}`;

if (!code.includes("setIsReportsMenuOpen(!isReportsMenuOpen)")) {
    code = code.replace(sidebarItemTarget, sidebarItemNew);
}

// 4. Add Component Render
const renderTarget = `{/* --- TAB 4: ADMIN MANAGEMENT --- */}`;

const renderNew = `{/* --- REPORTS --- */}
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

          ${renderTarget}`;

if (!code.includes("currentTab === 'reports_summary'")) {
    code = code.replace(renderTarget, renderNew);
}

fs.writeFileSync(path, code);
console.log("Patched App.jsx to restore reports menu");
