const fs = require('fs');
let code = fs.readFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', 'utf8');

const targetStr = `      if (hasGlobalView && filterZone !== 'all' && filterBranch === 'all') {`;

const index = code.indexOf(targetStr);
if (index !== -1) {
    const endStr = `      }`;
    const endIndex = code.indexOf(endStr, index) + endStr.length;
    
    const originalBlock = code.substring(index, endIndex);
    const newBlock = `      if (hasGlobalView && filterZone !== 'all' && filterBranch === 'all') {
        // Admin เลือกเขตแต่ไม่เลือกสาขา → กรองเฉพาะโครงการที่อยู่ในเขตนั้น
        const branchInZone = branches.find(b => String(b.pwa_code) === String(p.pwa_code));
        matchesBranch = branchInZone && String(branchInZone.zone) === String(filterZone);
      } else if (!hasGlobalView && filterBranch === 'all') {
        // ผู้ใช้ระดับเขต (RegAdmin) หรือระดับสาขา (User) หากไม่ได้เลือกสาขาเฉพาะเจาะจง ให้กรองตามเขตของตัวเอง
        const branchInZone = branches.find(b => String(b.pwa_code) === String(p.pwa_code));
        matchesBranch = branchInZone && String(branchInZone.zone) === String(user?.area);
      }`;
      
    code = code.substring(0, index) + newBlock + code.substring(endIndex);
    fs.writeFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', code);
    console.log("Success");
} else {
    console.log("Failed");
}
