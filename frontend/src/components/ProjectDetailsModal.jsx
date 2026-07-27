import React, { useMemo } from 'react';
import { X, Calendar, UserCheck } from 'lucide-react';

const MONTHS_TH = [
  { num: 10, name: 'ต.ค.' }, { num: 11, name: 'พ.ย.' }, { num: 12, name: 'ธ.ค.' },
  { num: 1, name: 'ม.ค.' }, { num: 2, name: 'ก.พ.' }, { num: 3, name: 'มี.ค.' },
  { num: 4, name: 'เม.ย.' }, { num: 5, name: 'พ.ค.' }, { num: 6, name: 'มิ.ย.' },
  { num: 7, name: 'ก.ค.' }, { num: 8, name: 'ส.ค.' }, { num: 9, name: 'ก.ย.' }
];

const PROJECT_TYPES = {
  1: 'ในแผน',
  2: 'เร่งด่วน',
  3: 'พิเศษ',
  4: 'สปส.'
};

export default function ProjectDetailsModal({ isOpen, onClose, project, monthlyData }) {
  if (!isOpen || !project) return null;

  // Find First Customer Date
  const firstCustomerMonthInfo = useMemo(() => {
    let earliest = null;
    monthlyData.forEach(m => {
      if (m.actual_users > 0) {
        if (!earliest || m.fiscal_year < earliest.fiscal_year || (m.fiscal_year === earliest.fiscal_year && MONTHS_TH.findIndex(x => x.num === m.month_number) < MONTHS_TH.findIndex(x => x.num === earliest.month_number))) {
          earliest = m;
        }
      }
    });
    if (!earliest) return null;
    const mName = MONTHS_TH.find(x => x.num === earliest.month_number)?.name || '';
    return `${mName} ${earliest.fiscal_year}`;
  }, [monthlyData]);

  // Completion Date logic (convert YYYY-MM-DD or MM/YYYY if possible to Thai text)
  // Assuming p.completed_date is in "MM/YYYY" format like "05/2564" or something, but the UI might just provide text.
  let formattedCompletedDate = project.completed_date;
  if (formattedCompletedDate && formattedCompletedDate.includes('/')) {
      const parts = formattedCompletedDate.split('/');
      if (parts.length === 2) {
          const mNum = parseInt(parts[0], 10);
          const mName = MONTHS_TH.find(x => x.num === mNum)?.name || parts[0];
          formattedCompletedDate = `${mName} ${parts[1]}`;
      } else if (parts.length === 3) {
           const mNum = parseInt(parts[1], 10);
           const mName = MONTHS_TH.find(x => x.num === mNum)?.name || parts[1];
           formattedCompletedDate = `${mName} ${parts[2]}`;
      }
  } else if (!formattedCompletedDate && project.start_year) {
      const calYear = parseInt(project.start_year, 10) - 1;
      formattedCompletedDate = `ต.ค. ${calYear} (ค่าเริ่มต้น)`;
  }

  const target = project.target_users || 0;
  const actual = project.accUsers || 0;
  const percentage = target > 0 ? ((actual / target) * 100).toFixed(1) : '0.0';

  // Heatmap Data processing
  const heatmapData = useMemo(() => {
    const dataByYear = {};
    const years = new Set();
    
    monthlyData.forEach(m => {
      if (!dataByYear[m.fiscal_year]) dataByYear[m.fiscal_year] = {};
      dataByYear[m.fiscal_year][m.month_number] = {
        actual: m.actual_users || 0,
        early: m.early_users || 0
      };
      years.add(m.fiscal_year);
    });

    if (project.start_year) years.add(parseInt(project.start_year, 10));
    
    const sortedYears = Array.from(years).sort((a, b) => a - b);

    return sortedYears.map(year => {
      const row = { year, total: 0, months: {} };
      MONTHS_TH.forEach((m) => {
        const cellData = dataByYear[year]?.[m.num] || { actual: 0, early: 0 };
        const val = cellData.actual;
        const early = cellData.early;
        const total = val + early;
        row.total += total;
        
        row.months[m.num] = { val: total, early, isBeforeComplete: early > 0 };
      });
      return row;
    });
  }, [monthlyData, project]);

  const totalAllTime = heatmapData.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header Section */}
        <div className="p-6 pb-4 relative border-b border-slate-100 flex-shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
          >
            <X size={20} />
          </button>
          
          <div className="pr-20">
             <div className="text-pwa-blue font-semibold text-lg mb-1">{project.project_code}</div>
             <h2 className="text-xl font-bold text-slate-800 leading-snug mb-2">{project.project_name}</h2>
             <div className="text-sm text-slate-500 font-medium">
               {project.province_name} · ปีงบ {project.start_year} · {PROJECT_TYPES[project.project_type] || 'ทั่วไป'}
             </div>
          </div>
          
          <div className="absolute top-6 right-16">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold shadow-sm">
              {actual} ราย
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
             {formattedCompletedDate && (
                 <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold shadow-sm">
                     <span className="text-emerald-500">✅</span> แล้วเสร็จ: {formattedCompletedDate}
                 </div>
             )}
             {firstCustomerMonthInfo && (
                 <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-teal-200 bg-teal-50 text-teal-700 text-xs font-semibold shadow-sm">
                     <UserCheck size={14} /> ลูกค้าเดือนแรก: {firstCustomerMonthInfo}
                 </div>
             )}
          </div>
          
          {/* Progress Bar */}
          <div className="mt-5 border-2 border-red-500 rounded-lg p-4">
             <div className="flex justify-between text-sm font-semibold mb-2">
                 <span className="text-slate-500">เป้าหมาย {target} ราย</span>
                 <span className="text-red-500">{percentage}%</span>
             </div>
             <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                 <div 
                    className="h-full bg-red-500 rounded-full" 
                    style={{ width: `${Math.min(100, (actual / (target || 1)) * 100)}%` }}
                 ></div>
             </div>
          </div>
        </div>

        {/* Body Section */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          {/* Heatmap */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
               <span className="flex items-center gap-2">
                 <span>HEATMAP รายเดือน</span>
                 <span className="text-xs font-medium normal-case text-slate-400">( สถิติการเกิดผู้ใช้น้ำสะสมรายเดือน )</span>
               </span>
               <span className="text-xs font-bold normal-case text-rose-700 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200 flex items-center gap-1.5 shadow-sm">
                  <span className="text-sm leading-none">🔴</span>
                  <span>= เกิดก่อนโครงการแล้วเสร็จ</span>
               </span>
            </h3>
            <div className="overflow-x-auto">
               <table className="w-full text-center border-separate" style={{ borderSpacing: '4px' }}>
                 <thead>
                   <tr>
                     <th className="p-1 w-16"></th>
                     {MONTHS_TH.map(m => (
                       <th key={m.num} className="p-1 text-xs font-bold text-slate-400 w-12">{m.name}</th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                   {heatmapData.map(row => (
                     <tr key={row.year}>
                       <td className="p-1 text-sm font-bold text-slate-600 text-left">{row.year}</td>
                       {MONTHS_TH.map(m => {
                         const cell = row.months[m.num];
                         const hasData = cell.val > 0;
                         return (
                           <td key={m.num} className="p-1">
                             <div className={`relative w-full h-10 flex items-center justify-center rounded text-sm font-semibold transition-colors ${hasData ? 'bg-emerald-400/90 text-white shadow-sm' : 'bg-slate-100 text-slate-300'}`}>
                               {hasData ? cell.val : '—'}
                               {hasData && cell.isBeforeComplete && (
                                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm"></div>
                               )}
                             </div>
                           </td>
                         )
                       })}
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>

          {/* Yearly Table */}
          <div>
             <h3 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">ตารางรายปีงบประมาณ</h3>
             <div className="border border-slate-200 rounded-xl overflow-hidden">
                 <table className="w-full text-sm text-center">
                     <thead className="bg-slate-100/80 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                         <tr>
                             <th className="p-3 font-bold text-left border-r border-slate-200">ปีงบ</th>
                             {MONTHS_TH.map(m => <th key={m.num} className="p-3 font-bold border-r border-slate-200">{m.name}</th>)}
                             <th className="p-3 font-bold text-slate-800">รวม</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {heatmapData.map(row => (
                             <tr key={row.year} className="hover:bg-slate-50 transition-colors">
                                 <td className="p-3 font-bold text-slate-700 border-r border-slate-200 text-left">{row.year}</td>
                                 {MONTHS_TH.map(m => {
                                     const val = row.months[m.num].val;
                                     return (
                                         <td key={m.num} className={`p-3 border-r border-slate-200 ${val > 0 ? 'text-emerald-600 font-bold' : 'text-slate-300'}`}>
                                             {val > 0 ? val : '—'}
                                         </td>
                                     );
                                 })}
                                 <td className="p-3 font-bold text-slate-800">{row.total}</td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
