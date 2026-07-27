const fs = require('fs');
let code = fs.readFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', 'utf8');

const regex = /\.filter\(branch => user\?\.role === 'admin' \|\| !branch\.branch_name\.includes\('การประปาส่วนภูมิภาคเขต'\)\)/g;
const replacement = ".filter(branch => !branch.branch_name.includes('เขต'))";

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', code);
    console.log("Success - replaced!");
} else {
    console.log("Regex not found!");
}
