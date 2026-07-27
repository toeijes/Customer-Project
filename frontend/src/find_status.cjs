const fs = require('fs');
const lines = fs.readFileSync('frontend/src/App.jsx', 'utf8').split(/\r?\n/);
lines.forEach((l, i) => {
  if (l.indexOf("c.status === 'T'") !== -1 || l.indexOf('c.status === "T"') !== -1) {
    console.log((i + 1) + ': ' + l.trim());
  }
});
