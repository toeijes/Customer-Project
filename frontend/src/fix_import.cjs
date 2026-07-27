const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

code = code.replace(
  "ChevronLeft, ChevronRight,",
  "ChevronLeft, ChevronRight, ChevronDown,"
);

fs.writeFileSync('frontend/src/App.jsx', code);
console.log('ChevronDown added to imports');
