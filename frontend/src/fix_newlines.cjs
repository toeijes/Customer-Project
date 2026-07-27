const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/\\n/g, '\n');

fs.writeFileSync(path, code);
console.log("Fixed newlines");
