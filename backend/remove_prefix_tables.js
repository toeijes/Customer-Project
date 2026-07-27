const fs = require('fs');

function replaceInFile(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');

    // App.jsx replacements
    code = code.replace(/กปภ\.สาขา\$\{rowItem\.name\}/g, '${rowItem.name}');
    code = code.replace(/กปภ\.สาขา\{selectedProjectMap\.branch_name\}/g, '{selectedProjectMap.branch_name}');
    code = code.replace(/กปภ\.สาขา\{p\.branch_name\}/g, '{p.branch_name}');
    code = code.replace(/>กปภ\.สาขา ⇅</g, '>สาขา ⇅<');
    code = code.replace(/>กปภ\.สาขา \(\{filterZone/g, '>สาขา ({filterZone');
    code = code.replace(/กปภ\.สาขา\$\{selectedBranchDrill\}/g, '${selectedBranchDrill}');
    code = code.replace(/กปภ\.สาขา\$\{branchName\}/g, '${branchName}');
    code = code.replace(/>กปภ\.สาขา</g, '>สาขา<');
    code = code.replace(/กปภ\.สาขา\{editingProject\.branch_name\}/g, '{editingProject.branch_name}');

    fs.writeFileSync(filePath, code);
}

replaceInFile('d:/Antigravity/Customer Project/frontend/src/App.jsx');
replaceInFile('d:/Antigravity/Customer Project/frontend/src/components/AdminManagement.jsx');

console.log("Replaced กปภ.สาขา in App.jsx and AdminManagement.jsx");
