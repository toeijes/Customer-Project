const fs = require('fs');

const file = 'frontend/src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

const helperFunction = `const getCustomerStatusInfo = (status) => {
  const code = String(status).trim();
  switch (code) {
    case '1': return { text: '1: ปกติ', colorClass: 'bg-emerald-100 text-emerald-800', badgeColor: '#10b981', badgeBg: '#ecfdf5', badgeBorder: '#a7f3d0' };
    case '2': return { text: '2: ฝากมาตร', colorClass: 'bg-blue-100 text-blue-800', badgeColor: '#3b82f6', badgeBg: '#eff6ff', badgeBorder: '#bfdbfe' };
    case '3': return { text: '3: หยุดจ่ายน้ำ(กรณีมาตรหาย,สาธารณภัย) งดใช้น้ำชั่วคราว', colorClass: 'bg-amber-100 text-amber-800', badgeColor: '#f59e0b', badgeBg: '#fef3c7', badgeBorder: '#fde68a' };
    case '4': return { text: '4: ตัดมาตร', colorClass: 'bg-orange-100 text-orange-800', badgeColor: '#ea580c', badgeBg: '#fff7ed', badgeBorder: '#ffedd5' };
    case '5': return { text: '5: ยกเลิกถาวร', colorClass: 'bg-red-100 text-red-800', badgeColor: '#ef4444', badgeBg: '#fef2f2', badgeBorder: '#fecaca' };
    case '6': return { text: '6: กปภ.ยกเลิก', colorClass: 'bg-rose-100 text-rose-800', badgeColor: '#e11d48', badgeBg: '#fff1f2', badgeBorder: '#ffe4e6' };
    case '7': return { text: '7: โอนสิทธิ(ไม่เป็นผู้ใช้น้ำ)', colorClass: 'bg-slate-100 text-slate-800', badgeColor: '#475569', badgeBg: '#f8fafc', badgeBorder: '#e2e8f0' };
    case 'T': return { text: 'ปกติ (Active)', colorClass: 'bg-emerald-100 text-emerald-800', badgeColor: '#10b981', badgeBg: '#ecfdf5', badgeBorder: '#a7f3d0' };
    default: return { text: status || '-', colorClass: 'bg-gray-100 text-gray-800', badgeColor: '#6b7280', badgeBg: '#f3f4f6', badgeBorder: '#e5e7eb' };
  }
};`;

if (!code.includes('getCustomerStatusInfo')) {
  code = code.replace('function App() {', `${helperFunction}\n\nfunction App() {`);
}

const mapTooltipOld = `<span style="font-size: 9px; font-weight: 800; color: \${c.status === 'T' ? '#10b981' : '#f59e0b'}; background: \${c.status === 'T' ? '#ecfdf5' : '#fef3c7'}; padding: 2px 6px; border-radius: 4px; border: 1px solid \${c.status === 'T' ? '#a7f3d0' : '#fde68a'}; font-family: 'Sarabun', sans-serif;">
                สถานะ: \${c.status === 'T' ? 'ปกติ (Active)' : c.status || '-'}
              </span>`;
const mapTooltipNew = `<span style="font-size: 9px; font-weight: 800; color: \${getCustomerStatusInfo(c.status).badgeColor}; background: \${getCustomerStatusInfo(c.status).badgeBg}; padding: 2px 6px; border-radius: 4px; border: 1px solid \${getCustomerStatusInfo(c.status).badgeBorder}; font-family: 'Sarabun', sans-serif;">
                สถานะ: \${getCustomerStatusInfo(c.status).text}
              </span>`;

const mapTooltip2Old = `<span style="font-size: 9px; font-weight: 800; color: \${c.status === 'T' ? '#10b981' : '#f59e0b'}; background: \${c.status === 'T' ? '#ecfdf5' : '#fef3c7'}; padding: 2px 6px; border-radius: 4px; border: 1px solid \${c.status === 'T' ? '#a7f3d0' : '#fde68a'}; font-family: 'Sarabun', sans-serif;">
                      สถานะ: \${c.status === 'T' ? 'ปกติ (Active)' : c.status || '-'}
                    </span>`;
const mapTooltip2New = `<span style="font-size: 9px; font-weight: 800; color: \${getCustomerStatusInfo(c.status).badgeColor}; background: \${getCustomerStatusInfo(c.status).badgeBg}; padding: 2px 6px; border-radius: 4px; border: 1px solid \${getCustomerStatusInfo(c.status).badgeBorder}; font-family: 'Sarabun', sans-serif;">
                      สถานะ: \${getCustomerStatusInfo(c.status).text}
                    </span>`;

const tableOld = `<span className={\`px-2 py-0.5 rounded-full font-bold text-[9px] \${
                              c.status === 'T' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }\`}>
                              {c.status === 'T' ? 'ปกติ (Active)' : c.status || '-'}
                            </span>`;
const tableNew = `<span className={\`px-2 py-0.5 rounded-full font-bold text-[9px] \${getCustomerStatusInfo(c.status).colorClass}\`}>
                              {getCustomerStatusInfo(c.status).text}
                            </span>`;

const exportOld = `c.status === 'T' ? 'ปกติ (Active)' : c.status || '-',`;
const exportNew = `getCustomerStatusInfo(c.status).text,`;

code = code.replace(mapTooltipOld, mapTooltipNew);
code = code.replace(mapTooltip2Old, mapTooltip2New);
code = code.replace(tableOld, tableNew);
code = code.replace(exportOld, exportNew);

fs.writeFileSync(file, code);
console.log('App.jsx updated with customer status mapping');
