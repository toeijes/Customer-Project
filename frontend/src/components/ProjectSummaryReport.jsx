import React, { useState, useEffect, useMemo } from 'react';
import ProjectDetailsModal from './ProjectDetailsModal';
import { Calendar, Filter, Users, Droplets, Target, ChevronDown, ChevronRight, TrendingUp, Download, Printer, Briefcase, CheckCircle2, XCircle, Award, Search, MapPin } from 'lucide-react';

const PROJECT_TYPES = {
  1: 'โครงการขยายเขตฯ (เงินรายได้)',
  2: 'โครงการขยายเขตฯ (เงินอุดหนุน)',
  3: 'โครงการขยายเขตฯ (กระตุ้นเศรษฐกิจ)',
  4: 'โครงการวางท่อเข้าซอย'
};

const TYPE_COLORS = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  3: 'bg-amber-50 text-amber-700 border-amber-200',
  4: 'bg-purple-50 text-purple-700 border-purple-200',
  default: 'bg-slate-50 text-slate-700 border-slate-200'
};

export default function ProjectSummaryReport({ branchesData = [], user }) {
  const [data, setData] = useState({ projects: [], yearly: [], monthly: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filterZone, setFilterZone] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterProjectYear, setFilterProjectYear] = useState('all');
  const now = new Date();
  const currentFiscalYear = now.getFullYear() + 543 + (now.getMonth() >= 9 ? 1 : 0);
  const [filterMonthlyYear, setFilterMonthlyYear] = useState(String(currentFiscalYear));
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedProjectForModal, setSelectedProjectForModal] = useState(null);

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
    return branches.filter(b => !b.branch_name.startsWith('การประปาส่วนภูมิภาคเขต'));
  }, [branchesData, filterZone, user]);

  useEffect(() => {
    if (filterZone !== 'all' && filterBranch !== 'all') {
      const branchExists = availableBranches.find(b => b.branch_name === filterBranch);
      if (!branchExists) setFilterBranch('all');
    }
  }, [filterZone, availableBranches, filterBranch]);

  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  useEffect(() => {
    fetch(`${API_BASE}/reports/project-summary`)
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData({
            projects: res.projects || [],
            yearly: res.yearly || [],
            monthly: res.monthly || []
          });
        } else {
          setError(res.error);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Prepare derived data
  const processedData = useMemo(() => {
    let filtered = data.projects;

    if ((filterZone !== 'all' || user?.role?.toLowerCase() !== 'admin') && filterBranch === 'all') {
      const pwaCodesInZone = availableBranches.map(b => String(b.pwa_code));
      filtered = filtered.filter(p => pwaCodesInZone.includes(String(p.pwa_code)));
    }
    
    if (filterBranch !== 'all') {
      const selectedBranch = availableBranches.find(b => b.branch_name === filterBranch);
      if (selectedBranch) {
        filtered = filtered.filter(p => String(p.pwa_code) === String(selectedBranch.pwa_code));
      } else {
        filtered = filtered.filter(p => p.branch_name === filterBranch);
      }
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(p => String(p.project_type) === filterType);
    }
    if (filterProjectYear !== 'all') {
      filtered = filtered.filter(p => String(p.start_year) === filterProjectYear);
    }

    // Map yearly and monthly data to each project
    const yearlyMap = {};
    data.yearly.forEach(y => {
      if (!yearlyMap[y.project_code]) yearlyMap[y.project_code] = {};
      yearlyMap[y.project_code][y.fiscal_year] = y.actual_users;
    });

    const monthlyMap = {};
    const earlyMonthlyMap = {};
    data.monthly.forEach(m => {
      if (String(m.fiscal_year) !== filterMonthlyYear) return;
      if (!monthlyMap[m.project_code]) monthlyMap[m.project_code] = {};
      if (!earlyMonthlyMap[m.project_code]) earlyMonthlyMap[m.project_code] = {};
      monthlyMap[m.project_code][m.month_number] = m.actual_users;
      earlyMonthlyMap[m.project_code][m.month_number] = m.early_users || 0;
    });

    let totalProjects = 0;
    let hasCustomers = 0;
    let noCustomers = 0;
    let totalAccUsers = 0;
    let totalTarget = 0;

    const enriched = filtered.map(p => {
      const pYearly = yearlyMap[p.project_code] || {};
      const pMonthly = monthlyMap[p.project_code] || {};
      
      let accUsers = 0;
      Object.values(pYearly).forEach(v => accUsers += (v || 0));

      const hasCus = accUsers > 0;
      if (filterStatus === 'has' && !hasCus) return null;
      if (filterStatus === 'none' && hasCus) return null;

      totalProjects++;
      if (hasCus) hasCustomers++;
      else noCustomers++;
      
      totalAccUsers += accUsers;
      totalTarget += (p.target_users || 0);

      // Group months by quarter (Oct=10, Nov=11, Dec=12, Jan=1, Feb=2, Mar=3, Apr=4, May=5, Jun=6, Jul=7, Aug=8, Sep=9)
      const q1 = (pMonthly[10]||0) + (pMonthly[11]||0) + (pMonthly[12]||0);
      const q2 = (pMonthly[1]||0) + (pMonthly[2]||0) + (pMonthly[3]||0);
      const q3 = (pMonthly[4]||0) + (pMonthly[5]||0) + (pMonthly[6]||0);
      const q4 = (pMonthly[7]||0) + (pMonthly[8]||0) + (pMonthly[9]||0);

      return {
        ...p,
        accUsers,
        yearly: pYearly,
        monthly: pMonthly,
        earlyMonthly: earlyMonthlyMap[p.project_code] || {},
        q1, q2, q3, q4
      };
    }).filter(Boolean);

    // Group by branch or zone
    const isGlobalAndNoZone = (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all';
    const grouped = {};
    enriched.forEach(p => {
      let key = p.branch_name;
      if (isGlobalAndNoZone) {
        const branchInZone = availableBranches.find(b => String(b.pwa_code) === String(p.pwa_code));
        if (branchInZone) {
          key = `กปภ.เขต ${branchInZone.zone}`;
        }
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    const successRate = totalTarget > 0 ? ((totalAccUsers / totalTarget) * 100).toFixed(1) : 0;

    return {
      grouped,
      enriched,
      summary: { totalProjects, hasCustomers, noCustomers, totalAccUsers, totalTarget, successRate }
    };
  }, [data, filterBranch, filterType, filterProjectYear, filterMonthlyYear, filterStatus, filterZone, availableBranches]);

  if (loading) return <div className="p-8 text-center text-slate-500">กำลังโหลดข้อมูล...</div>;
  if (error) return <div className="p-8 text-center text-red-500">เกิดข้อผิดพลาด: {error}</div>;

  const { grouped, summary } = processedData;

  // Extract all unique project fiscal years
  const projectYears = [...new Set(data.projects.map(p => p.start_year).filter(Boolean))].sort((a,b)=>b-a);
  
  // Year columns from 2564 up to max year
  const startYear = 2564;
  const endYear = Math.max(currentFiscalYear, 2569);
  const yearCols = [];
  for (let y = startYear; y <= endYear; y++) yearCols.push(y);
  const handleExportCSV = () => {
    if (!processedData.enriched || processedData.enriched.length === 0) return;
    
    // Define headers
    let csvContent = "ลำดับ,รหัสโครงการ,ชื่อโครงการ,ประเภท,สาขา,ปีงบประมาณ,วันที่แล้วเสร็จ,เป้าหมาย(ราย),ความสำเร็จ(%),ผชน.สะสมรวม,";
    // Add year columns
    yearCols.forEach(y => {
      csvContent += `ปีงบ ${String(y).substring(2)},`;
    });
    csvContent += "ต.ค.,พ.ย.,ธ.ค.,ม.ค.,ก.พ.,มี.ค.,เม.ย.,พ.ค.,มิ.ย.,ก.ค.,ส.ค.,ก.ย.,";
    csvContent += "Q1,Q2,Q3,Q4\n";

    // Add rows
    processedData.enriched.forEach((p, idx) => {
      const achievement = p.target_users > 0 ? ((p.accUsers / p.target_users) * 100).toFixed(1) : '0.0';
      const typeStr = PROJECT_TYPES[p.project_type] || `ประเภท ${p.project_type}`;
      
      let row = [
        idx + 1,
        `"${p.project_code}"`,
        `"${p.project_name || ''}"`,
        `"${typeStr}"`,
        `"${p.branch_name}"`,
        p.start_year,
        `"${p.completed_date || ''}"`,
        p.target_users || 0,
        achievement,
        p.accUsers || 0
      ];

      yearCols.forEach(y => {
        row.push(p.yearly[y] || 0);
      });

      const months = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      months.forEach((m) => {
        row.push(p.monthly[m] || 0);
      });

      row.push(p.monthly.q1 || 0);
      row.push(p.monthly.q2 || 0);
      row.push(p.monthly.q3 || 0);
      row.push(p.monthly.q4 || 0);

      csvContent += row.join(",") + "\n";
    });

    // Create and download Blob
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `project_summary_report_${filterMonthlyYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-pwa-blue-dark tracking-tight">รายงานสรุปผลการดำเนินงานโครงการ</h2>
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

      {/* Filters & Actions - Single Line */}
      <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl shadow-sm border border-slate-200/60 p-3.5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-pwa-blue"></div>
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-1">
              <div className="p-1.5 bg-blue-100/80 rounded-lg text-pwa-blue">
                <Filter size={18} strokeWidth={2.5} />
              </div>
              <h3 className="font-bold text-slate-700 text-sm whitespace-nowrap">ตัวกรองข้อมูลรายงาน:</h3>
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
                onChange={e=>setFilterBranch(e.target.value)} 
                disabled={user?.role?.toLowerCase() === 'admin' && filterZone === 'all'}
                className={`px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:border-pwa-blue focus:ring-2 focus:ring-pwa-blue/20 transition-all font-medium text-slate-700 shadow-sm outline-none ${(user?.role?.toLowerCase() === 'admin' && filterZone === 'all') ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'bg-white'}`}
              >
                <option value="all">{(user?.role?.toLowerCase() === 'admin' && filterZone === 'all') ? 'กรุณาเลือกเขตก่อน' : 'ทุกสาขา'}</option>
                {availableBranches.map(b => <option key={b.ba} value={b.branch_name}>{b.branch_name.replace(/\s*\(ข\.\d+\)\s*/g, '')}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">ประเภทโครงการ:</label>
              <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-pwa-blue focus:ring-2 focus:ring-pwa-blue/20 transition-all font-medium text-slate-700 shadow-sm outline-none">
                <option value="all">ทุกประเภท</option>
                <option value="1">{PROJECT_TYPES[1]}</option>
                <option value="2">{PROJECT_TYPES[2]}</option>
                <option value="3">{PROJECT_TYPES[3]}</option>
                <option value="4">{PROJECT_TYPES[4]}</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">ปีงบฯ:</label>
              <select value={filterProjectYear} onChange={e=>setFilterProjectYear(e.target.value)} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-pwa-blue focus:ring-2 focus:ring-pwa-blue/20 transition-all font-medium text-slate-700 shadow-sm outline-none">
                <option value="all">ทุกปีงบฯ</option>
                {projectYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">สถานะบรรลุ:</label>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-pwa-blue focus:ring-2 focus:ring-pwa-blue/20 transition-all font-medium text-slate-700 shadow-sm outline-none">
                <option value="all">ทั้งหมด</option>
                <option value="achieved">บรรลุเป้าหมาย (≥ 100%)</option>
                <option value="in_progress">กำลังดำเนินการ (&lt; 100%)</option>
                <option value="no_users">ยังไม่มีผู้ใช้น้ำ (0 ราย)</option>
              </select>
            </div>
          </div>

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(59,130,246,0.15)] border border-blue-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="relative z-10 flex items-center justify-between mb-1">
            <div className="text-xs font-bold text-blue-800/70">โครงการทั้งหมด</div>
            <div className="p-1.5 bg-blue-100/80 rounded-lg text-blue-600 group-hover:scale-110 transition-transform duration-300">
              <Briefcase size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl font-black text-blue-700 tracking-tight">{summary.totalProjects}</div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-blue-400/5 to-blue-500/10 rounded-full blur-xl group-hover:bg-blue-400/20 transition-colors duration-500"></div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(16,185,129,0.15)] border border-emerald-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="relative z-10 flex items-center justify-between mb-1">
            <div className="text-xs font-bold text-emerald-800/70">มีผู้ใช้น้ำแล้ว</div>
            <div className="p-1.5 bg-emerald-100/80 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform duration-300">
              <CheckCircle2 size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl font-black text-emerald-700 tracking-tight">{summary.hasCustomers}</div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-emerald-400/5 to-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-400/20 transition-colors duration-500"></div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(244,63,94,0.15)] border border-rose-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(244,63,94,0.3)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="relative z-10 flex items-center justify-between mb-1">
            <div className="text-xs font-bold text-rose-800/70">ยังไม่มีผู้ใช้น้ำ</div>
            <div className="p-1.5 bg-rose-100/80 rounded-lg text-rose-600 group-hover:scale-110 transition-transform duration-300">
              <XCircle size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl font-black text-rose-600 tracking-tight">{summary.noCustomers}</div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-rose-400/5 to-rose-500/10 rounded-full blur-xl group-hover:bg-rose-400/20 transition-colors duration-500"></div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(99,102,241,0.15)] border border-indigo-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(99,102,241,0.3)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="relative z-10 flex items-center justify-between mb-1">
            <div className="text-xs font-bold text-indigo-800/70">ผชน.สะสมรวม</div>
            <div className="p-1.5 bg-indigo-100/80 rounded-lg text-indigo-600 group-hover:scale-110 transition-transform duration-300">
              <Users size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl font-black text-indigo-700 tracking-tight">{summary.totalAccUsers.toLocaleString()}</div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-indigo-400/5 to-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-400/20 transition-colors duration-500"></div>
        </div>

        <div className="bg-gradient-to-br from-sky-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(14,165,233,0.15)] border border-sky-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(14,165,233,0.3)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="relative z-10 flex items-center justify-between mb-1">
            <div className="text-xs font-bold text-sky-800/70">เป้าหมาย (ราย)</div>
            <div className="p-1.5 bg-sky-100/80 rounded-lg text-sky-600 group-hover:scale-110 transition-transform duration-300">
              <Target size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl font-black text-sky-600 tracking-tight">{summary.totalTarget.toLocaleString()}</div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-sky-400/5 to-sky-500/10 rounded-full blur-xl group-hover:bg-sky-400/20 transition-colors duration-500"></div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(245,158,11,0.15)] border border-amber-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 transition-all duration-300">
          <div className="relative z-10 flex items-center justify-between mb-1">
            <div className="text-xs font-bold text-amber-800/70">ความสำเร็จ</div>
            <div className="p-1.5 bg-amber-100/80 rounded-lg text-amber-600 group-hover:scale-110 transition-transform duration-300">
              <Award size={16} strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl font-black text-amber-500 tracking-tight">{summary.successRate}%</div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-amber-400/5 to-amber-500/10 rounded-full blur-xl group-hover:bg-amber-400/20 transition-colors duration-500"></div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-none shadow-md border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse min-w-max relative">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-pwa-blue-dark border-b border-pwa-blue text-xs text-white uppercase tracking-wide">
                <th rowSpan="2" className="p-3 border-r border-b border-white/10 font-semibold whitespace-nowrap bg-pwa-blue-dark">#</th>
                <th rowSpan="2" className="p-3 border-r border-b border-white/10 font-semibold w-64 min-w-[250px] bg-pwa-blue-dark">รหัสโครงการ / รายการ</th>
                <th rowSpan="2" className="p-3 border-r border-b border-white/10 font-semibold text-center whitespace-nowrap bg-pwa-blue-dark">ประเภท</th>
                <th rowSpan="2" className="p-3 border-r border-b border-white/10 font-semibold whitespace-nowrap bg-pwa-blue-dark">สาขา</th>
                <th rowSpan="2" className="p-3 border-r border-b border-white/10 font-semibold text-center whitespace-nowrap bg-pwa-blue-dark">ปีงบ</th>
                <th rowSpan="2" className="p-3 border-r border-b border-white/10 font-semibold text-center whitespace-nowrap bg-pwa-blue-dark">วันที่แล้วเสร็จ</th>
                <th rowSpan="2" className="p-3 border-r border-b border-white/10 font-semibold text-right whitespace-nowrap bg-pwa-blue-dark">เป้าหมาย<br/>(ราย)</th>
                <th rowSpan="2" className="p-3 border-r border-b border-white/10 font-bold text-right text-yellow-300 whitespace-nowrap bg-pwa-blue-dark">ผชน.เพิ่ม<br/>สะสม</th>
                <th colSpan={yearCols.length} className="p-2 border-r border-b border-white/10 font-semibold text-center whitespace-nowrap bg-pwa-blue text-white/90">ผชน.เกิดจริงรายปีงบ (ราย)</th>
                <th colSpan="16" className="p-2 font-semibold text-center border-b border-white/10 whitespace-nowrap bg-pwa-blue text-white/90">ปีงบ {filterMonthlyYear.substring(2)} รายเดือน (ราย)</th>
              </tr>
              <tr className="bg-pwa-blue border-b border-pwa-blue-dark text-xs text-white uppercase tracking-wide">
                {yearCols.map(y => <th key={y} className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">{String(y).substring(2)}</th>)}
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">ต.ค.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">พ.ย.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">ธ.ค.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">ม.ค.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">ก.พ.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">มี.ค.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">เม.ย.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">พ.ค.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">มิ.ย.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">ก.ค.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">ส.ค.</th>
                <th className="p-2 border-r border-b border-white/10 text-center whitespace-nowrap bg-pwa-blue">ก.ย.</th>
                <th className="p-2 border-r border-b text-center font-bold text-yellow-200 bg-pwa-blue whitespace-nowrap">Q1</th>
                <th className="p-2 border-r border-b text-center font-bold text-yellow-200 bg-pwa-blue whitespace-nowrap">Q2</th>
                <th className="p-2 border-r border-b text-center font-bold text-yellow-200 bg-pwa-blue whitespace-nowrap">Q3</th>
                <th className="p-2 text-center border-b font-bold text-yellow-200 bg-pwa-blue whitespace-nowrap">Q4</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(grouped).length === 0 ? (
                <tr><td colSpan="100" className="p-12 text-center text-slate-500 font-medium">ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา</td></tr>
              ) : (
                Object.entries(grouped).sort((a,b)=>{
                  const getBa = (name) => {
                    const br = branchesData.find(x => x.branch_name === name);
                    return br ? String(br.ba || br.pwa_code || name) : name;
                  };
                  return getBa(a[0]).localeCompare(getBa(b[0]), undefined, {numeric: true});
                }).map(([branchName, projects]) => (
                  <React.Fragment key={branchName}>
                    <tr className="bg-blue-50 border-b border-blue-100">
                      <td colSpan="100" className="p-3 font-bold text-pwa-blue shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-4 rounded-full bg-pwa-blue"></div>
                          {branchName}
                        </div>
                      </td>
                    </tr>
                    {projects.map((p, idx) => {
                      const achievement = p.target_users > 0 ? ((p.accUsers / p.target_users) * 100).toFixed(0) : 0;
                      const achievementNum = Number(achievement);
                      const achievementColor = achievementNum >= 100 ? 'text-emerald-600' : achievementNum >= 70 ? 'text-amber-500' : 'text-rose-500';
                      return (
                        <tr key={p.project_code} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                          <td className="p-3 border-r text-center text-slate-500">{idx + 1}</td>
                          <td className="p-3 border-r">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                               <span 
                                  className="font-extrabold text-pwa-blue cursor-pointer hover:underline flex items-center gap-1"
                                  onClick={() => {
                                     const fullMonthly = data.monthly.filter(m => String(m.project_code) === String(p.project_code));
                                     setSelectedProjectForModal({ ...p, fullMonthly });
                                  }}
                                  title="คลิกเพื่อเปิดป๊อปอัพดูรายละเอียดโครงการและ HEATMAP รายเดือน"
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
                            <div 
                               className="text-xs text-slate-600 line-clamp-2 mt-0.5 min-w-[200px] cursor-pointer hover:text-pwa-blue hover:underline" 
                               onClick={() => {
                                  const fullMonthly = data.monthly.filter(m => String(m.project_code) === String(p.project_code));
                                  setSelectedProjectForModal({ ...p, fullMonthly });
                               }}
                               title={`คลิกเพื่อเปิดป๊อปอัพดูรายละเอียดโครงการ ${p.project_name} และ HEATMAP รายเดือน`}
                            >
                               {p.project_name}
                            </div>
                          </td>
                          <td className="p-3 border-r text-center">
                            <span className={`px-2.5 py-1 shadow-sm border rounded-lg text-[10.5px] whitespace-nowrap font-medium ${TYPE_COLORS[p.project_type] || TYPE_COLORS.default}`}>
                              {PROJECT_TYPES[p.project_type] || `ประเภท ${p.project_type}`}
                            </span>
                          </td>
                          <td className="p-3 border-r whitespace-nowrap text-slate-700">{p.branch_name}</td>
                          <td className="p-3 border-r text-center whitespace-nowrap text-slate-700">{p.start_year}</td>
                          <td className="p-3 border-r text-center text-emerald-600 font-medium whitespace-nowrap">
                            {p.completed_date || '-'}
                          </td>
                          <td className="p-3 border-r text-right whitespace-nowrap">
                            <div className="font-semibold text-slate-700">{p.target_users || '-'}</div>
                            {p.target_users > 0 && <div className={`text-[10px] mt-0.5 font-bold ${achievementColor}`}>{achievement}%</div>}
                          </td>
                          <td 
                        className="p-3 border-r text-right font-bold text-pwa-blue whitespace-nowrap cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => {
                            // Extract full monthly data for this project
                            const fullMonthly = data.monthly.filter(m => String(m.project_code) === String(p.project_code));
                            setSelectedProjectForModal({ ...p, fullMonthly });
                        }}
                        title="คลิกเพื่อดูรายละเอียดโครงการและ HEATMAP"
                      >
                        <span className="border-b border-dashed border-pwa-blue pb-0.5">{p.accUsers || '-'}</span>
                      </td>
                          {yearCols.map(y => (
                            <td key={y} className="p-2 border-r text-center text-slate-600 whitespace-nowrap">
                              {p.yearly[y] || '-'}
                            </td>
                          ))}
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[10] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[11] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[12] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[1] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[2] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[3] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[4] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[5] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[6] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[7] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[8] || '-'}</td>
                          <td className="p-2 border-r text-center text-slate-500">{p.monthly[9] || '-'}</td>
                          <td className="p-2 border-r text-center font-bold text-pwa-blue bg-blue-50/40">{p.q1 || '-'}</td>
                          <td className="p-2 border-r text-center font-bold text-pwa-blue bg-blue-50/40">{p.q2 || '-'}</td>
                          <td className="p-2 border-r text-center font-bold text-pwa-blue bg-blue-50/40">{p.q3 || '-'}</td>
                          <td className="p-2 text-center font-bold text-pwa-blue bg-blue-50/40">{p.q4 || '-'}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ProjectDetailsModal 
        isOpen={!!selectedProjectForModal}
        onClose={() => setSelectedProjectForModal(null)}
        project={selectedProjectForModal}
        monthlyData={selectedProjectForModal?.fullMonthly || []}
      />
    </div>
  );
}
