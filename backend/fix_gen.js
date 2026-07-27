const fs = require('fs');
let c = fs.readFileSync('generate_discarded_report.js', 'utf8');
c = c.replace(/\\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('generate_discarded_report.js', c);
