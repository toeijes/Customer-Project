const fs = require('fs');
const lines = fs.readFileSync('frontend/src/App.jsx', 'utf8').split(/\r?\n/);
const idx = lines.findIndex(l => l.includes('currentTab === \'reports_summary\''));
console.log(lines.slice(Math.max(0, idx - 10), idx + 20).join('\n'));
