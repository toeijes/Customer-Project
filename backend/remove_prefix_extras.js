const fs = require('fs');

function replaceInFile(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');

    // Remove กปภ.สาขา from map tooltip
    code = code.replace(/<strong style="color: #6b7280;">กปภ\.สาขา:<\/strong>/g, '<strong style="color: #6b7280;">สาขา:</strong>');
    
    // Remove กปภ.สาขา from Excel export header
    code = code.replace(/const headerRow = \['กปภ\.สาขา',/g, "const headerRow = ['สาขา',");

    fs.writeFileSync(filePath, code);
}

replaceInFile('d:/Antigravity/Customer Project/frontend/src/App.jsx');

console.log("Replaced remaining กปภ.สาขา in App.jsx");
