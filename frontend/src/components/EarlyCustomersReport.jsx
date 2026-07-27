import React, { useState, useMemo } from 'react';
import { AlertTriangle, Download, Printer, Search, MapPin, Filter, Briefcase, Users } from 'lucide-react';
import ProjectDetailsModal from './ProjectDetailsModal';
import EarlyCustomerDetailsModal from './EarlyCustomerDetailsModal';

const MONTHS_TH = [
  { num: 10, name: 'ต.ค.' }, { num: 11, name: 'พ.ย.' }, { num: 12, name: 'ธ.ค.' },
  { num: 1, name: 'ม.ค.' }, { num: 2, name: 'ก.พ.' }, { num: 3, name: 'มี.ค.' },
  { num: 4, name: 'เม.ย.' }, { num: 5, name: 'พ.ค.' }, { num: 6, name: 'มิ.ย.' },
  { num: 7, name: 'ก.ค.' }, { num: 8, name: 'ส.ค.' }, { num: 9, name: 'ก.ย.' }
];

export default function EarlyCustomersReport({ projects, monthlyData, branchesData, user }) {
  const [filterZone, setFilterZone] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [selectedProjectForModal, setSelectedProjectForModal] = useState(null);
  const [selectedEarlyProject, setSelectedEarlyProject] = useState(null);

  const availableZones = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const availableBranches = useMemo(() => {
    let branches = branchesData;
    if (user?.role?.toLowerCase() !== 'admin') {
      if (user?.area) {
        branches = branches.filter(b => String(b.zone) === String(user.area));
      }
    } else if (filterZone !== 'all') {
      branches = branches.filter(b => String(b.zone) === String(filterZone));
    }
    return branches.filter(b => !b.branch_name.startsWith('การประปาส่วนภูมิภาคเขต')).sort((a, b) => String(a.ba).localeCompare(String(b.ba)));
  }, [branchesData, filterZone, user]);

  React.useEffect(() => {
    if (filterZone !== 'all' && filterBranch !== 'all') {
      const branchExists = availableBranches.find(b => b.branch_name === filterBranch);
      if (!branchExists) setFilterBranch('all');
    }
  }, [filterZone, availableBranches, filterBranch]);

  // Process data to find "early customers" (customers before completion date)
  const processedData = useMemo(() => {
    // Organize monthly data by project_code
    const monthlyMap = {};
    monthlyData.forEach(m => {
      if (!monthlyMap[m.project_code]) monthlyMap[m.project_code] = [];
      monthlyMap[m.project_code].push(m);
    });

    const earlyProjects = [];
    
    projects.forEach(p => {
      const pMonthly = monthlyMap[p.project_code] || [];
      let abnormalCount = 0;
      let minMonthAbs = Infinity;
      let minDateStr = '';
      let maxMonthAbs = -Infinity;
      let maxDateStr = '';
      let problemMonthsCount = 0;

      // Group monthly data and find first/last problem months
      pMonthly.forEach(m => {
        if (m.early_users > 0) {
          abnormalCount += m.early_users;
          problemMonthsCount++;
          
          const calYear = m.month_number >= 10 ? m.fiscal_year - 1 : m.fiscal_year;
          const currentAbsolute = calYear * 12 + m.month_number;
          
          if (currentAbsolute < minMonthAbs) {
            minMonthAbs = currentAbsolute;
            minDateStr = `${m.month_name} ${calYear}`;
          }
          if (currentAbsolute > maxMonthAbs) {
            maxMonthAbs = currentAbsolute;
            maxDateStr = `${m.month_name} ${calYear}`;
          }
        }
      });

      if (abnormalCount > 0) {
        earlyProjects.push({
          ...p,
          fullMonthly: pMonthly,
          abnormal_customers: abnormalCount,
          abnormal_months_count: problemMonthsCount,
          earliest_label: minDateStr,
          latest_label: maxDateStr
        });
      }
    });

    // Apply branch/zone filter
    let filtered = earlyProjects;
    if ((filterZone !== 'all' || user?.role?.toLowerCase() !== 'admin') && filterBranch === 'all') {
      const pwaCodesInZone = availableBranches.map(b => String(b.pwa_code));
      filtered = filtered.filter(p => pwaCodesInZone.includes(String(p.pwa_code)));
    } else if (filterBranch !== 'all') {
      filtered = filtered.filter(p => String(p.branch_name) === String(filterBranch));
    }

    // Group by branch or zone
    const isGlobalAndNoZone = (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all';
    const grouped = {};
    filtered.forEach(p => {
      let key = p.branch_name || 'ไม่ทราบสาขา';
      if (isGlobalAndNoZone) {
        const branchInZone = availableBranches.find(b => String(b.pwa_code) === String(p.pwa_code));
        if (branchInZone) {
          key = `กปภ.เขต ${branchInZone.zone}`;
        }
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    // Calculate summaries
    const totalProjects = filtered.length;
    const totalBranches = Object.keys(grouped).length;
    const totalAbnormal = filtered.reduce((sum, p) => sum + p.abnormal_customers, 0);
    const maxAbnormal = filtered.reduce((max, p) => p.abnormal_customers > max ? p.abnormal_customers : max, 0);

    return { earlyProjects: filtered, grouped, totalProjects, totalBranches, totalAbnormal, maxAbnormal };
  }, [projects, monthlyData, filterBranch, filterZone, user, availableBranches]);

  // Handle Export CSV
  const handleExportCSV = () => {
    if (!processedData.earlyProjects || processedData.earlyProjects.length === 0) {
      alert('ไม่พบข้อมูลสำหรับส่งออก CSV');
      return;
    }

    const headers = ['รหัสโครงการ', 'เลขที่สัญญา', 'ชื่อโครงการ', 'สาขา', 'วันที่เสร็จสิ้นสัญญา', 'จำนวนผู้ใช้น้ำผิดปกติ (เปิดก่อนกำหนด)'];
    const rows = processedData.earlyProjects.map(p => [
      p.project_code,
      p.contract_no || '-',
      p.project_name,
      p.branch_name,
      p.completed_date || '-',
      p.abnormal_customers || 0
    ]);

    let csvContent = '\uFEFF';
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      const escapedRow = row.map(v => `"${String(v).replace(/"/g, '""')}"`);
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `early_customers_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-pwa-blue-dark tracking-tight">รายงานลูกค้าก่อนโครงการเสร็จ</h2>
          {user?.role?.toLowerCase() !== 'admin' && user?.area && (
            <div className="flex items-center gap-1.5 bg-[#00529b] px-3 py-1.5 rounded-md text-white font-bold text-sm shadow-[0_2px_4px_rgba(0,0,0,0.15)] ml-2">
              <MapPin size={16} strokeWidth={2.5} className="text-[#ff1493] fill-[#ff1493]" />
              <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>เขต  {user.area}</span>
            </div>
          )}
          {user?.role?.toLowerCase() === 'admin' && (
            <div className="flex items-center gap-1.5 bg-[#00529b] px-3 py-1.5 rounded-md text-white font-bold text-sm shadow-[0_2px_4px_rgba(0,0,0,0.15)] ml-2">
              <MapPin size={16} strokeWidth={2.5} className="text-[#ff1493] fill-[#ff1493]" />
              <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>ภาพรวม กปภ.</span>
            </div>
          )}
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
        <span className="text-sm font-medium">
          โครงการที่ยังไม่มีวันที่แล้วเสร็จ ระบบจะใช้วันแรกของปีงบประมาณในโครงการนั้นแทน
        </span>
      </div>

      {/* Filters & Actions - Single Line Bar */}
      <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl shadow-sm border border-slate-200/60 p-3.5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-pwa-blue"></div>
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          
          {/* Left: Filter icon, Title & Selects */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-1">
              <div className="p-1.5 bg-blue-100/80 rounded-lg text-pwa-blue">
                <Filter size={18} strokeWidth={2.5} />
              </div>
              
            </div>

            {user?.role?.toLowerCase() === 'admin' && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">กปภ.เขต:</label>
                <select value={filterZone} onChange={e=>setFilterZone(e.target.value)} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-pwa-blue focus:ring-2 focus:ring-pwa-blue/20 transition-all font-medium text-slate-700 shadow-sm outline-none">
                  <option value="all">ทุกเขต</option>
                  {availableZones.map(z => <option key={z} value={z}>เขต {z}</option>)}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">สาขา:</label>
              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                disabled={user?.role?.toLowerCase() === 'admin' && filterZone === 'all'}
                className={`w-48 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:border-pwa-blue focus:ring-2 focus:ring-pwa-blue/20 transition-all font-medium text-slate-700 shadow-sm outline-none ${(user?.role?.toLowerCase() === 'admin' && filterZone === 'all') ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'bg-white'}`}
              >
                <option value="all">{(user?.role?.toLowerCase() === 'admin' && filterZone === 'all') ? 'กรุณาเลือกเขตก่อน' : 'ทุกสาขา'}</option>
                {availableBranches.map(b => (
                  <option key={b.pwa_code} value={b.branch_name}>{b.branch_name.replace(/\s*\(ข\.\d+\)\s*/g, '')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 print:hidden">
            <button 
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#00a651] hover:bg-[#008e45] text-white rounded-full text-xs font-extrabold shadow-md hover:shadow-lg transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Download size={16} />
              ส่งออก CSV
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 bg-slate-700 text-white rounded-xl text-xs hover:bg-slate-800 shadow-sm hover:-translate-y-0.5 font-medium transition-all flex items-center gap-2 whitespace-nowrap">
              <Printer size={14} /> พิมพ์
            </button>
          </div>

        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
         <div className="bg-gradient-to-br from-rose-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(244,63,94,0.15)] border border-rose-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(244,63,94,0.3)] hover:-translate-y-0.5 transition-all duration-300">
             <div className="relative z-10 flex items-center justify-between mb-1">
                 <div className="text-xs font-bold text-rose-800/70">โครงการที่พบปัญหา</div>
                 <div className="p-1.5 bg-rose-100/80 rounded-lg text-rose-600 group-hover:scale-110 transition-transform duration-300">
                     <AlertTriangle size={16} strokeWidth={2.5} />
                 </div>
             </div>
             <div className="relative z-10">
                 <div className="text-2xl font-black text-rose-600 tracking-tight">{processedData.totalProjects.toLocaleString()}</div>
             </div>
             <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-rose-400/5 to-rose-500/10 rounded-full blur-xl group-hover:bg-rose-400/20 transition-colors duration-500"></div>
         </div>
         <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(59,130,246,0.15)] border border-blue-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 transition-all duration-300">
             <div className="relative z-10 flex items-center justify-between mb-1">
                 <div className="text-xs font-bold text-blue-800/70">สาขาที่ได้รับผลกระทบ</div>
                 <div className="p-1.5 bg-blue-100/80 rounded-lg text-blue-600 group-hover:scale-110 transition-transform duration-300">
                     <Briefcase size={16} strokeWidth={2.5} />
                 </div>
             </div>
             <div className="relative z-10">
                 <div className="text-2xl font-black text-blue-700 tracking-tight">{processedData.totalBranches.toLocaleString()}</div>
             </div>
             <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-blue-400/5 to-blue-500/10 rounded-full blur-xl group-hover:bg-blue-400/20 transition-colors duration-500"></div>
         </div>
         <div className="bg-gradient-to-br from-orange-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(249,115,22,0.15)] border border-orange-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(249,115,22,0.3)] hover:-translate-y-0.5 transition-all duration-300">
             <div className="relative z-10 flex items-center justify-between mb-1">
                 <div className="text-xs font-bold text-orange-800/70">จำนวนลูกค้าที่ผิดปกติรวม</div>
                 <div className="p-1.5 bg-orange-100/80 rounded-lg text-orange-600 group-hover:scale-110 transition-transform duration-300">
                     <Users size={16} strokeWidth={2.5} />
                 </div>
             </div>
             <div className="relative z-10">
                 <div className="text-2xl font-black text-orange-600 tracking-tight">{processedData.totalAbnormal.toLocaleString()}</div>
             </div>
             <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-orange-400/5 to-orange-500/10 rounded-full blur-xl group-hover:bg-orange-400/20 transition-colors duration-500"></div>
         </div>
         <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(168,85,247,0.15)] border border-purple-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(168,85,247,0.3)] hover:-translate-y-0.5 transition-all duration-300">
             <div className="relative z-10 flex items-center justify-between mb-1">
                 <div className="text-xs font-bold text-purple-800/70">ยอดผิดปกติสูงสุดต่อโครงการ</div>
                 <div className="p-1.5 bg-purple-100/80 rounded-lg text-purple-600 group-hover:scale-110 transition-transform duration-300">
                     <AlertTriangle size={16} strokeWidth={2.5} />
                 </div>
             </div>
             <div className="relative z-10">
                 <div className="text-2xl font-black text-purple-600 tracking-tight">{processedData.maxAbnormal.toLocaleString()}</div>
             </div>
             <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-purple-400/5 to-purple-500/10 rounded-full blur-xl group-hover:bg-purple-400/20 transition-colors duration-500"></div>
         </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-none shadow-md border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse min-w-max relative">
            <thead className="sticky top-0 z-10 shadow-sm">
               <tr className="bg-pwa-blue-dark border-b border-pwa-blue text-xs text-white uppercase tracking-wide">
                  <th className="p-3 border-r border-b border-white/10 font-semibold whitespace-nowrap bg-pwa-blue-dark text-center w-12">#</th>
                  <th className="p-3 border-r border-b border-white/10 font-semibold bg-pwa-blue-dark min-w-[250px]">รหัสโครงการ / รายการ</th>
                  <th className="p-3 border-r border-b border-white/10 font-semibold whitespace-nowrap bg-pwa-blue-dark text-center">ปีงบ</th>
                  <th className="p-3 border-r border-b border-white/10 font-semibold whitespace-nowrap bg-pwa-blue-dark text-center">วันที่แล้วเสร็จ</th>
                  <th className="p-3 border-r border-b border-white/10 font-semibold whitespace-nowrap bg-pwa-blue-dark text-center">ลูกค้าผิดปกติ</th>
                  <th className="p-3 border-r border-b border-white/10 font-semibold whitespace-nowrap bg-pwa-blue-dark text-center">จำนวนเดือน</th>
                  <th className="p-3 border-r border-b border-white/10 font-semibold whitespace-nowrap bg-pwa-blue-dark text-center">เดือนแรกสุด</th>
                  <th className="p-3 border-r border-b border-white/10 font-semibold whitespace-nowrap bg-pwa-blue-dark text-center">เดือนล่าสุด</th>
               </tr>
            </thead>
            <tbody>
              {Object.keys(processedData.grouped).length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400 font-medium">ไม่พบข้อมูลโครงการที่ผิดปกติ</td>
                </tr>
              ) : (
                Object.entries(processedData.grouped).sort().map(([branch, branchProjects]) => {
                  const branchTotalAbnormal = branchProjects.reduce((sum, p) => sum + p.abnormal_customers, 0);
                  
                  return (
                    <React.Fragment key={branch}>
                      {/* Branch Header Row */}
                      <tr className="bg-blue-50/50 border-b border-slate-200">
                         <td colSpan="8" className="p-2.5 font-bold text-pwa-blue-dark text-xs border-r border-slate-200">
                             <span className="text-blue-500 mr-1">{branchProjects[0]?.pwa_code}</span> 📍 {branch} <span className="text-slate-500 ml-2 font-medium text-[11px]">{branchProjects.length} โครงการ · {branchTotalAbnormal} ราย</span>
                         </td>
                      </tr>
                      
                      {/* Projects Rows */}
                      {branchProjects.map((p, idx) => (
                        <tr key={p.project_code} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                           <td className="p-3 text-center text-slate-500 font-medium text-xs border-r border-slate-200">{idx + 1}</td>
                           <td className="p-3 border-r border-slate-200">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                   <span 
                                      className="font-bold text-pwa-blue cursor-pointer hover:underline"
                                      onClick={() => setSelectedEarlyProject(p)}
                                   >
                                      {p.project_code}
                                   </span>
                                   {p.contract_no ? (
                                      <span className="text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200" title={`เลขที่สัญญา: ${p.contract_no}`}>
                                         สัญญา: {p.contract_no}
                                      </span>
                                   ) : (
                                      <span className="text-[11px] text-slate-400 font-mono italic">(ไม่มีสัญญา)</span>
                                   )}
                                </div>
                                <div className="text-xs text-slate-600 line-clamp-2 leading-snug">{p.project_name}</div>
                            </td>
                           <td className="p-3 text-center font-medium text-slate-700 border-r border-slate-200">{p.start_year}</td>
                           <td className="p-3 text-center font-bold text-amber-600 border-r border-slate-200">{p.completed_date}</td>
                           <td className="p-3 text-center border-r border-slate-200">
                               <button 
                                 onClick={() => setSelectedEarlyProject(p)}
                                 className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 hover:border-red-300 px-2.5 py-1 rounded-full font-bold text-xs min-w-[32px] transition-all flex items-center gap-1.5 mx-auto shadow-sm group"
                               >
                                   <Users size={12} className="group-hover:scale-110 transition-transform" />
                                   {p.abnormal_customers}
                               </button>
                           </td>
                           <td className="p-3 text-center font-medium text-slate-600 border-r border-slate-200 text-xs">{p.abnormal_months_count} เดือน</td>
                           <td className="p-3 text-center font-semibold text-red-500 border-r border-slate-200 text-xs">{p.earliest_label}</td>
                           <td className="p-3 text-center font-semibold text-red-500 border-r border-slate-200 text-xs">{p.latest_label}</td>
                        </tr>
                      ))}

                      {/* Branch Footer Summary Row */}
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                         <td colSpan="4" className="p-2 text-right font-bold text-slate-600 text-xs border-r border-slate-200">รวม {branch}</td>
                         <td className="p-2 text-center border-r border-slate-200">
                             <span className="bg-red-50 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-full font-bold text-xs">
                                 {branchTotalAbnormal}
                             </span>
                         </td>
                         <td colSpan="3" className="border-r border-slate-200 bg-white"></td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {Object.keys(processedData.grouped).length > 0 && (
              <tfoot>
                <tr className="bg-red-50/50 border-t-2 border-red-200">
                   <td colSpan="4" className="p-3 text-center font-bold text-red-700 text-sm border-r border-red-100">รวมทั้งหมด</td>
                   <td className="p-3 text-center border-r border-red-100 font-bold text-red-700 text-sm">{processedData.totalAbnormal} ราย</td>
                   <td colSpan="3" className="bg-white"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
      <ProjectDetailsModal 
        isOpen={!!selectedProjectForModal}
        onClose={() => setSelectedProjectForModal(null)}
        project={selectedProjectForModal}
        monthlyData={selectedProjectForModal?.fullMonthly || []}
      />
      <EarlyCustomerDetailsModal 
        isOpen={!!selectedEarlyProject}
        onClose={() => setSelectedEarlyProject(null)}
        project={selectedEarlyProject}
      />
    </div>
  );
}
