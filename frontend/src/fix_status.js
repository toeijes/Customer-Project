const fs = require('fs');

const file = 'frontend/src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

const helperFunction = `const getCustomerStatusInfo = (status) => {
  const code = String(status).trim();
  switch (code) {
    case '1': return { text: 'ปกติ', colorClass: 'bg-emerald-100 text-emerald-800', badgeColor: '#10b981', badgeBg: '#ecfdf5', badgeBorder: '#a7f3d0' };
    case '2': return { text: 'ฝากมาตร', colorClass: 'bg-blue-100 text-blue-800', badgeColor: '#3b82f6', badgeBg: '#eff6ff', badgeBorder: '#bfdbfe' };
    case '3': return { text: 'หยุดจ่ายน้ำ(กรณีมาตรหาย,สาธารณภัย) งดใช้น้ำชั่วคราว', colorClass: 'bg-amber-100 text-amber-800', badgeColor: '#f59e0b', badgeBg: '#fef3c7', badgeBorder: '#fde68a' };
    case '4': return { text: 'ตัดมาตร', colorClass: 'bg-orange-100 text-orange-800', badgeColor: '#ea580c', badgeBg: '#fff7ed', badgeBorder: '#ffedd5' };
    case '5': return { text: 'ยกเลิกถาวร', colorClass: 'bg-red-100 text-red-800', badgeColor: '#ef4444', badgeBg: '#fef2f2', badgeBorder: '#fecaca' };
    case '6': return { text: 'กปภ.ยกเลิก', colorClass: 'bg-rose-100 text-rose-800', badgeColor: '#e11d48', badgeBg: '#fff1f2', badgeBorder: '#ffe4e6' };
    case '7': return { text: 'โอนสิทธิ(ไม่เป็นผู้ใช้น้ำ)', colorClass: 'bg-slate-100 text-slate-800', badgeColor: '#475569', badgeBg: '#f8fafc', badgeBorder: '#e2e8f0' };
    case 'T': return { text: 'ปกติ (Active)', colorClass: 'bg-emerald-100 text-emerald-800', badgeColor: '#10b981', badgeBg: '#ecfdf5', badgeBorder: '#a7f3d0' };
    default: return { text: status || '-', colorClass: 'bg-gray-100 text-gray-800', badgeColor: '#6b7280', badgeBg: '#f3f4f6', badgeBorder: '#e5e7eb' };
  }
};`;

// Insert the helper function right before the App component definition
if (!code.includes('getCustomerStatusInfo')) {
  code = code.replace('function App() {', `${helperFunction}\n\nfunction App() {`);
}

// 1. Line 569-570: Map tooltip
code = code.replace(
  /background: \$\{c\.status === 'T' \? '#ecfdf5' : '#fef3c7'\}; padding: 2px 6px; border-radius: 4px; border: 1px solid \$\{c\.status === 'T' \? '#a7f3d0' : '#fde68a'\}; font-family: 'Sarabun', sans-serif;"\>\n\s+สถานะ: \$\{c\.status === 'T' \? 'ปกติ \(Active\)' : c\.status \|\| '-'\}/g,
  `background: \$\{getCustomerStatusInfo(c.status).badgeBg\}; padding: 2px 6px; border-radius: 4px; border: 1px solid \$\{getCustomerStatusInfo(c.status).badgeBorder\}; font-family: 'Sarabun', sans-serif;"\>
                สถานะ: \$\{getCustomerStatusInfo(c.status).text\}`
);

// We need to also replace the color property in the tooltip style
code = code.replace(
  /color: \$\{c\.status === 'T' \? '#10b981' : '#f59e0b'\}; background:/g,
  `color: \$\{getCustomerStatusInfo(c.status).badgeColor\}; background:`
);

// 2. Line 681: Excel export
code = code.replace(
  /c\.status === 'T' \? 'ปกติ \(Active\)' : c\.status \|\| '-',/g,
  `getCustomerStatusInfo(c.status).text,`
);

// 3. Line 3260-3262: Table row
code = code.replace(
  /className=\{`px-2 py-0\.5 rounded-full font-bold text-\[9px\] \$\{\n\s+c\.status === 'T' \? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'\n\s+\}`\}\>\n\s+\{c\.status === 'T' \? 'ปกติ \(Active\)' : c\.status \|\| '-'\}/g,
  `className={\`px-2 py-0.5 rounded-full font-bold text-[9px] \${getCustomerStatusInfo(c.status).colorClass}\`}>
                              {getCustomerStatusInfo(c.status).text}`
);

fs.writeFileSync(file, code);
console.log('App.jsx updated with customer status mapping');
