const fs = require('fs');

const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add filterZone state
if (!code.includes("const [filterZone, setFilterZone]")) {
  code = code.replace(
    /const \[filterYear, setFilterYear\] = useState\('all'\);\s*const \[filterBranch, setFilterBranch\] = useState\('all'\);/,
    "const [filterYear, setFilterYear] = useState('all');\n  const [filterZone, setFilterZone] = useState('all');\n  const [filterBranch, setFilterBranch] = useState('all');"
  );
}

// 2. Add filterZone to resetFilters
if (!code.includes("setFilterZone('all');")) {
  code = code.replace(
    /const resetFilters = \(\) => \{\s*setFilterYear\('all'\);\s*setFilterBranch\('all'\);/,
    "const resetFilters = () => {\n    setFilterYear('all');\n    setFilterZone('all');\n    setFilterBranch('all');"
  );
}

fs.writeFileSync(path, code);
console.log("Patched App.jsx state properly");
