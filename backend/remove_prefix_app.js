const fs = require('fs');
let code = fs.readFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', 'utf8');

code = code.replace(/กปภ\.สาขา\{b\.branch_name\}/g, '{b.branch_name}');

fs.writeFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', code);
console.log("Replaced กปภ.สาขา in App.jsx");
