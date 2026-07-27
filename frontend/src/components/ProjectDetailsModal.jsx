import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, UserCheck } from 'lucide-react';

const MONTHS_TH = [
  { num: 10, name: 'ต.ค.' }, { num: 11, name: 'พ.ย.' }, { num: 12, name: 'ธ.ค.' },
  { num: 1, name: 'ม.ค.' }, { num: 2, name: 'ก.พ.' }, { num: 3, name: 'มี.ค.' },
  { num: 4, name: 'เม.ย.' }, { num: 5, name: 'พ.ค.' }, { num: 6, name: 'มิ.ย.' },
  { num: 7, name: 'ก.ค.' }, { num: 8, name: 'ส.ค.' }, { num: 9, name: 'ก.ย.' }
];

const PROJECT_TYPES = {
  1: 'โครงการขยายเขตฯ (เงินรายได้)',
  2: 'โครงการขยายเขตฯ (เงินอุดหนุน)',
  3: 'โครงการขยายเขตฯ (กระตุ้นเศรษฐกิจ)',
  4: 'โครงการวางท่อเข้าซอย'
};

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function ProjectDetailsModal({ isOpen, onClose, project, monthlyData = [] }) {
  const [fetchedMonthly, setFetchedMonthly] = useState([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  useEffect(() => {
    if (!isOpen || !project?.project_code) return;

    if (monthlyData && monthlyData.length > 0) {
      setFetchedMonthly(monthlyData);
      return;
    }

    async function fetchMonthlyDetails() {
      try {
        setLoadingMonthly(true);
        const res = await fetch(`${API_BASE}/project-monthly-details/${project.project_code}`);
        if (res.ok) {
          const json = await res.json();
          setFetchedMonthly(json.monthly || []);
        }
      } catch (err) {
        console.error('Failed to fetch monthly details:', err);
      } finally {
        setLoadingMonthly(false);
      }
    }

    fetchMonthlyDetails();
  }, [isOpen, project, monthlyData]);

  const activeMonthlyData = useMemo(() => {
    if (fetchedMonthly && fetchedMonthly.length > 0) return fetchedMonthly;
    return monthlyData || [];
  }, [monthlyData, fetchedMonthly]);

  // Find First Customer Date
  const firstCustomerMonthInfo = useMemo(() => {
    if (!activeMonthlyData || activeMonthlyData.length === 0) return null;
    let earliest = null;
    activeMonthlyData.forEach(m => {
      if ((m.actual_users || 0) > 0 || (m.early_users || 0) > 0) {
        if (!earliest || m.fiscal_year < earliest.fiscal_year || (m.fiscal_year === earliest.fiscal_year && MONTHS_TH.findIndex(x => x.num === m.month_number) < MONTHS_TH.findIndex(x => x.num === earliest.month_number))) {
          earliest = m;
        }
      }
    });
    if (!earliest) return null;
    const mName = MONTHS_TH.find(x => x.num === earliest.month_number)?.name || '';
    return `${mName} ${earliest.fiscal_year}`;
  }, [activeMonthlyData]);

  // Heatmap Data processing
  const heatmapData = useMemo(() => {
    if (!project) return [];
    const dataByYear = {};
    const years = new Set();
    
    if (activeMonthlyData) {
      activeMonthlyData.forEach(m => {
        if (!dataByYear[m.fiscal_year]) dataByYear[m.fiscal_year] = {};
        dataByYear[m.fiscal_year][m.month_number] = {
          actual: m.actual_users || 0,
          early: m.early_users || 0
        };
        years.add(m.fiscal_year);
      });
    }

    if (project.start_year) years.add(parseInt(project.start_year, 10));
    if (project.completion_year) years.add(parseInt(project.completion_year, 10));
    
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
  }, [activeMonthlyData, project]);

  // EARLY RETURN CAN ONLY BE PLACED HERE AFTER ALL HOOKS!
  if (!isOpen || !project) return null;

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        
        {/* Header Section */}
        <div className="p-6 pb-4 relative border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition cursor-pointer"
          >
            <X size={20} />
          </button>
          
          <div className="pr-20">
             <div className="text-pwa-blue font-extrabold text-lg mb-1 flex items-center gap-2">
                <span>{project.project_code}</span>
                {project.contract_no && (
                   <span className="text-xs font-mono font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                      สัญญา: {project.contract_no}
                   </span>
                )}
             </div>
             <h2 className="text-xl font-bold text-slate-800 leading-snug mb-2">{project.project_name}</h2>
             <div className="text-xs text-slate-500 font-medium">
               {project.branch_name} · ปีงบ {project.start_year} · {PROJECT_TYPES[project.project_type] || 'โครงการขยายเขตฯ'}
             </div>
          </div>
          
          <div className="absolute top-6 right-16">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold shadow-sm text-sm">
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
          <div className="mt-5 border-2 border-red-500 rounded-lg p-4 bg-white">
             <div className="flex justify-between text-sm font-semibold mb-2">
                 <span className="text-slate-600">เป้าหมาย {target} ราย</span>
                 <span className="text-red-600 font-bold">{percentage}%</span>
             </div>
             <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                 <div 
                    className="h-full bg-red-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (actual / (target || 1)) * 100)}%` }}
                 ></div>
             </div>
          </div>
        </div>

        {/* Body Section */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Heatmap Section */}
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
               <span className="flex items-center gap-2">
                 <span>HEATMAP รายเดือน</span>
                 <span className="text-xs font-medium normal-case text-slate-500">( สถิติการเกิดผู้ใช้น้ำสะสมรายเดือน )</span>
               </span>
               <span className="text-xs font-bold normal-case text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 flex items-center gap-1.5 shadow-sm">
                  <span className="text-sm leading-none">🔴</span>
                  <span>= เกิดก่อนโครงการแล้วเสร็จ</span>
               </span>
            </h3>

            {loadingMonthly ? (
              <div className="py-8 text-center text-slate-400 font-medium text-xs">กำลังโหลดข้อมูล Heatmap รายเดือน...</div>
            ) : (
              <div className="overflow-x-auto">
                 <table className="w-full text-center border-separate" style={{ borderSpacing: '4px' }}>
                   <thead>
                     <tr>
                       <th className="p-1 w-16"></th>
                       {MONTHS_TH.map(m => (
                         <th key={m.num} className="p-1 text-xs font-bold text-slate-500 w-12">{m.name}</th>
                       ))}
                     </tr>
                   </thead>
                   <tbody>
                     {heatmapData.map(row => (
                       <tr key={row.year}>
                         <td className="p-1 text-xs font-extrabold text-slate-700 text-left whitespace-nowrap">{row.year}</td>
                         {MONTHS_TH.map(m => {
                           const cell = row.months[m.num];
                           const hasData = cell.val > 0;
                           const isBeforeComplete = cell.isBeforeComplete;

                           return (
                             <td key={m.num} className="p-0.5">
                               <div className={`relative w-full h-10 flex items-center justify-center rounded-xl text-sm font-black transition-all shadow-sm cursor-pointer ${
                                 isBeforeComplete 
                                   ? 'bg-rose-600 text-white ring-2 ring-rose-300 shadow-rose-200 scale-105 z-10' 
                                   : hasData 
                                   ? 'bg-emerald-500 text-white' 
                                   : 'bg-white border border-slate-200 text-slate-300'
                               }`}
                               title={isBeforeComplete ? `เดือนนี้มีผู้ใช้น้ำเกิดก่อนโครงการแล้วเสร็จ ${cell.early} ราย (รวม ${cell.val} ราย)` : (hasData ? `${cell.val} ราย` : 'ไม่มีข้อมูล')}
                               >
                                 {hasData ? (
                                   <span className="flex items-center justify-center gap-0.5">
                                     {isBeforeComplete && <span className="text-[11px] leading-none animate-pulse">🔴</span>}
                                     <span>{cell.val}</span>
                                   </span>
                                 ) : '—'}
                               </div>
                             </td>
                           );
                         })}
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
            )}
          </div>

          {/* Yearly Table */}
          <div>
             <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">ตารางสรุปรายปีงบประมาณ</h3>
             <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                 <table className="w-full text-xs text-center border-collapse">
                     <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                         <tr>
                             <th className="p-2.5 text-left border-r border-slate-200">ปีงบ</th>
                             {MONTHS_TH.map(m => <th key={m.num} className="p-2.5 border-r border-slate-200">{m.name}</th>)}
                             <th className="p-2.5 text-slate-800 bg-slate-200/50">รวม</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {heatmapData.map(row => (
                             <tr key={row.year} className="hover:bg-slate-50/80 transition-colors">
                                 <td className="p-2.5 font-bold text-slate-700 border-r border-slate-200 text-left">{row.year}</td>
                                 {MONTHS_TH.map(m => {
                                     const cell = row.months[m.num];
                                     const val = cell.val;
                                     const isEarly = cell.isBeforeComplete;
                                     return (
                                         <td key={m.num} className={`p-2.5 border-r border-slate-200 ${isEarly ? 'text-rose-600 font-black bg-rose-50' : val > 0 ? 'text-emerald-600 font-bold' : 'text-slate-300'}`}>
                                             {val > 0 ? (
                                               <span className="inline-flex items-center justify-center gap-0.5">
                                                 {isEarly && <span className="text-[10px]">🔴</span>}
                                                 <span>{val}</span>
                                               </span>
                                             ) : '—'}
                                         </td>
                                     );
                                 })}
                                 <td className="p-2.5 font-extrabold text-slate-800 bg-slate-50">{row.total}</td>
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
