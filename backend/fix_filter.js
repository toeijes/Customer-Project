const fs = require('fs');
let code = fs.readFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', 'utf8');

const target = `      if (hasGlobalView && filterZone !== 'all' && filterBranch === 'all') {
        // Admin เลือกเขตแต่ไม่เลือกสาขา → กรองเฉพาะโครงการที่อยู่ในเขตนั้น
        const branchInZone = branches.find(b => String(b.pwa_code) === String(p.pwa_code));
        matchesBranch = branchInZone && String(branchInZone.zone) === String(filterZone);
      }`;

const replacement = `      if (hasGlobalView && filterZone !== 'all' && filterBranch === 'all') {
        // Admin เลือกเขตแต่ไม่เลือกสาขา → กรองเฉพาะโครงการที่อยู่ในเขตนั้น
        const branchInZone = branches.find(b => String(b.pwa_code) === String(p.pwa_code));
        matchesBranch = branchInZone && String(branchInZone.zone) === String(filterZone);
      } else if (!hasGlobalView && filterBranch === 'all') {
        // ผู้ใช้ระดับเขต (RegAdmin) หรือระดับสาขา (User) หากไม่ได้เลือกสาขาเฉพาะเจาะจง ให้กรองตามเขตของตัวเอง
        const branchInZone = branches.find(b => String(b.pwa_code) === String(p.pwa_code));
        matchesBranch = branchInZone && String(branchInZone.zone) === String(user?.area);
      }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('d:/Antigravity/Customer Project/frontend/src/App.jsx', code);
    console.log("Successfully updated App.jsx");
} else {
    console.log("Target not found!");
}
