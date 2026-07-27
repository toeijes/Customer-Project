const fs = require('fs');
const file = 'backend/routes/admin.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "const legacyRole = role.level >= 100 ? 'admin' : (role.name === 'Planning' ? 'Planning' : 'user');",
  "const legacyRole = role.level >= 100 ? 'admin' : (role.name === 'Planning' ? 'Planning' : (role.name === 'RegAdmin' ? 'RegAdmin' : 'user'));"
);

fs.writeFileSync(file, code);
console.log('admin.js updated legacyRole logic');
