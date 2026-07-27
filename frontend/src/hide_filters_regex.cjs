const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

code = code.replace(
  /\{\/\* Filter Bar \*\/\}\s*\{currentTab !== 'admin' && \(/,
  `{/* Filter Bar */}
        {currentTab !== 'admin' && !currentTab.startsWith('reports') && (`
);

fs.writeFileSync('frontend/src/App.jsx', code);
console.log('App.jsx filter logic updated');
