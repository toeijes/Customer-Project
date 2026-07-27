const fs = require('fs');

const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add import
if (!code.includes("import EarlyCustomersReport")) {
    code = code.replace(
        "import ProjectSummaryReport from './components/ProjectSummaryReport';",
        "import ProjectSummaryReport from './components/ProjectSummaryReport';\nimport EarlyCustomersReport from './components/EarlyCustomersReport';"
    );
}

// 2. Add Sidebar menu item
const sidebarItemTarget = `                <div className={\`w-1.5 h-1.5 rounded-full \${currentTab === 'reports_summary' ? 'bg-pwa-cyan' : 'bg-blue-400'}\`} />
                สรุปรายโครงการ
              </button>
              {/* Add more reports here in the future */}`;

const sidebarItemNew = `                <div className={\`w-1.5 h-1.5 rounded-full \${currentTab === 'reports_summary' ? 'bg-pwa-cyan' : 'bg-blue-400'}\`} />
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
              {/* Add more reports here in the future */}`;

code = code.replace(sidebarItemTarget, sidebarItemNew);

// 3. Add Component Render
const renderTarget = `          {/* --- REPORTS --- */}
          {currentTab === 'reports_summary' && (
            <div className="space-y-4 animate-fadeIn">
              <ProjectSummaryReport branchesData={branches} user={user} />
            </div>
          )}`;

const renderNew = `          {/* --- REPORTS --- */}
          {currentTab === 'reports_summary' && (
            <div className="space-y-4 animate-fadeIn">
              <ProjectSummaryReport branchesData={branches} user={user} />
            </div>
          )}
          {currentTab === 'reports_early_customers' && (
            <div className="space-y-4 animate-fadeIn">
              <EarlyCustomersReport projects={projects} monthlyData={monthlyData} branchesData={branches} />
            </div>
          )}`;

code = code.replace(renderTarget, renderNew);

fs.writeFileSync(path, code);
console.log("Patched App.jsx for EarlyCustomersReport");
