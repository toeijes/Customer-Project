const fs = require('fs');
const lines = fs.readFileSync('frontend/src/App.jsx', 'utf8').split(/\r?\n/);
let matches = 0;
lines.forEach((l, i) => {
  if (l.includes("currentTab === 'reports_summary' && (")) {
    console.log(`Match at line ${i + 1}:`);
    console.log(lines.slice(Math.max(0, i - 5), i + 10).join('\n'));
    matches++;
  }
});
if (matches === 0) console.log('No matches found for render block');
