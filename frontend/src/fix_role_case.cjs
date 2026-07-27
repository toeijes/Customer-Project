const fs = require('fs');

['frontend/src/App.jsx', 'frontend/src/components/ProjectSummaryReport.jsx', 'frontend/src/components/EarlyCustomersReport.jsx'].forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/user\?\.role === 'admin'/g, "user?.role?.toLowerCase() === 'admin'");
  code = code.replace(/user\?\.role === 'planning'/g, "user?.role?.toLowerCase() === 'planning'");
  code = code.replace(/user\?\.role !== 'admin'/g, "user?.role?.toLowerCase() !== 'admin'");
  fs.writeFileSync(file, code);
  console.log('Fixed ' + file);
});
