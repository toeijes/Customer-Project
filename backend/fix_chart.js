const fs = require('fs');
let code = fs.readFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', 'utf8');

const regex = /const relevantBranches = branches\.filter\(b => String\(b\.zone\) === String\(filterZone\)\);/g;
const replacement = "const relevantBranches = branches.filter(b => String(b.zone) === String(filterZone) && !b.branch_name.includes('เขต'));";

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', code);
    console.log("Success - replaced!");
} else {
    console.log("Regex not found!");
}
