const fs = require('fs');
const file = 'backend/database/auth_schema.sql';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "role ENUM('admin', 'user') DEFAULT 'user',",
  "role VARCHAR(50) DEFAULT 'user',"
);

fs.writeFileSync(file, code);
console.log('auth_schema.sql updated');
