const fs = require('fs');

const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

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

          {/* --- TAB 4: ADMIN MANAGEMENT --- */}`;

if (!code.includes("<ProjectSummaryReport")) {
    code = code.replace(renderTarget, renderNew);
    fs.writeFileSync(path, code);
    console.log("Patched App.jsx to restore report rendering");
} else {
    console.log("Report rendering already exists or could not be patched.");
}
