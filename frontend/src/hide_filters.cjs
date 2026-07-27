const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

const target = `{/* Filter Bar */}
        {currentTab !== 'admin' && (
          <div className="bg-pwa-blue-light/30 border-b border-pwa-blue-light/80 px-8 py-4 flex flex-wrap gap-4 items-center shrink-0">`;

const replaceWith = `{/* Filter Bar */}
        {currentTab !== 'admin' && !currentTab.startsWith('reports') && (
          <div className="bg-pwa-blue-light/30 border-b border-pwa-blue-light/80 px-8 py-4 flex flex-wrap gap-4 items-center shrink-0">`;

code = code.replace(target, replaceWith);

fs.writeFileSync('frontend/src/App.jsx', code);
console.log('Filter bar hidden for reports');
