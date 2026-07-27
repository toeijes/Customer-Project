const fs = require('fs');

const path = 'd:/Antigravity/Customer Project/frontend/src/components/ProjectSummaryReport.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add import
if (!code.includes("import ProjectDetailsModal")) {
    code = code.replace(
        "import React, { useState, useEffect, useMemo } from 'react';",
        "import React, { useState, useEffect, useMemo } from 'react';\nimport ProjectDetailsModal from './ProjectDetailsModal';"
    );
}

// 2. Add state
if (!code.includes("const [selectedProjectForModal, setSelectedProjectForModal] = useState(null);")) {
    code = code.replace(
        "const [filterStatus, setFilterStatus] = useState('all');",
        "const [filterStatus, setFilterStatus] = useState('all');\n  const [selectedProjectForModal, setSelectedProjectForModal] = useState(null);"
    );
}

// 3. Modify table cell
const originalCell = `<td className="p-3 border-r text-right font-bold text-pwa-blue whitespace-nowrap">
                        {p.accUsers || '-'}
                      </td>`;
const newCell = `<td 
                        className="p-3 border-r text-right font-bold text-pwa-blue whitespace-nowrap cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => {
                            // Extract full monthly data for this project
                            const fullMonthly = data.monthly.filter(m => String(m.project_code) === String(p.project_code));
                            setSelectedProjectForModal({ ...p, fullMonthly });
                        }}
                        title="คลิกเพื่อดูรายละเอียดโครงการและ HEATMAP"
                      >
                        <span className="border-b border-dashed border-pwa-blue pb-0.5">{p.accUsers || '-'}</span>
                      </td>`;

// Let's use regex to be safe with indentation
code = code.replace(/<td className="p-3 border-r text-right font-bold text-pwa-blue whitespace-nowrap">\s*\{p\.accUsers \|\| '-'\}\s*<\/td>/, newCell);

// 4. Render modal at the end before final div
if (!code.includes("<ProjectDetailsModal")) {
    code = code.replace(
        "      </div>\n    </div>\n  );\n}",
        `      </div>\n      <ProjectDetailsModal \n        isOpen={!!selectedProjectForModal}\n        onClose={() => setSelectedProjectForModal(null)}\n        project={selectedProjectForModal}\n        monthlyData={selectedProjectForModal?.fullMonthly || []}\n      />\n    </div>\n  );\n}`
    );
}

fs.writeFileSync(path, code);
console.log("Patched ProjectSummaryReport.jsx");
