import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CheckCircle2, CircleDollarSign, Droplets, RefreshCw, Search, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PWA_ZONES, formatPwaZone } from '../pwaDisplay';

const number = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
});

const statusInfo = {
  break_even: { label: 'คืนทุนแล้ว', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  near_break_even: { label: 'ใกล้คืนทุน', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  needs_attention: { label: 'ต้องติดตาม', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  missing_budget: { label: 'ไม่มีงบลงทุน', className: 'bg-slate-100 text-slate-600 border-slate-200' }
};

const ZONE_TEXT_COLORS = {
  1: 'text-blue-600', 2: 'text-cyan-600', 3: 'text-teal-600', 4: 'text-emerald-600', 5: 'text-lime-600',
  6: 'text-blue-600', 7: 'text-orange-600', 8: 'text-rose-600', 9: 'text-purple-600', 10: 'text-indigo-600'
};

const normalizeBranchName = (branchName) => String(branchName || '')
  .replace(/\s+/g, ' ')
  .replace(/^การประปาส่วนภูมิภาค\s*สาขา\s*/i, '')
  .replace(/^กปภ\.\s*สาขา\s*/i, '')
  .replace(/^สาขา\s*/i, '')
  .trim();

const pendingDashboardRequests = new Map();

const fetchInvestmentDashboard = (apiBase, queryString) => {
  const requestKey = `${apiBase}/investment-breakeven/summary?${queryString}`;
  if (!pendingDashboardRequests.has(requestKey)) {
    const request = fetch(requestKey, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 403 ? 'Access denied' : 'Failed to load investment data');
        return response.json();
      })
      .finally(() => pendingDashboardRequests.delete(requestKey));
    pendingDashboardRequests.set(requestKey, request);
  }
  return pendingDashboardRequests.get(requestKey);
};

export default function InvestmentBreakEven({ apiBase, branches = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zone, setZone] = useState('all');
  const [branch, setBranch] = useState('all');
  const [type, setType] = useState('all');
  const [year, setYear] = useState('all');
  const [availableYears, setAvailableYears] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInvestmentTarget, setShowInvestmentTarget] = useState(true);
  const [projectPage, setProjectPage] = useState(1);
  const projectsPerPage = 10;
  const statusDetailsRef = useRef(null);

  const availableBranches = useMemo(() => (
    zone === 'all' ? [] : branches.filter(item => String(item.zone) === String(zone))
  ), [branches, zone]);

  const branchDetails = useMemo(() => new Map(
    branches.filter(item => item.pwa_code).map(item => [String(item.pwa_code), item])
  ), [branches]);

  const branchDetailsByName = useMemo(() => new Map(
    branches.map(item => [normalizeBranchName(item.branch_name), item])
  ), [branches]);

  useEffect(() => {
    let isCurrentRequest = true;
    const params = new URLSearchParams();
    if (zone !== 'all') params.set('zone', zone);
    if (branch !== 'all') params.set('branch', branch);
    if (type !== 'all') params.set('type', type);
    if (year !== 'all') params.set('year', year);

    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        const dashboardData = await fetchInvestmentDashboard(apiBase, params.toString());
        if (!isCurrentRequest) return;
        setData(dashboardData);
        if (year === 'all') {
          const years = [...new Set((dashboardData.projects || []).map(project => project.start_year).filter(Boolean))];
          setAvailableYears(years.sort((a, b) => b - a));
        }
      } catch (loadError) {
        if (isCurrentRequest) {
          setData(null);
          setError(loadError.message);
        }
      } finally {
        if (isCurrentRequest) setLoading(false);
      }
    }

    loadDashboard();
    return () => { isCurrentRequest = false; };
  }, [apiBase, branch, type, year, zone]);

  const chartData = useMemo(() => {
    const investment = Number(data?.metrics?.total_budget || 0);
    const monthly = data?.monthly || [];
    return monthly.map((row, index) => {
      const month = String(row.debt_ym || '');
      return {
        label: month.length === 6 ? `${month.slice(4, 6)}/${month.slice(0, 4)}` : month,
        revenue: monthly.slice(0, index + 1).reduce((total, item) => total + Number(item.total_amount || 0), 0),
        investment
      };
    });
  }, [data]);

  const chartSummary = useMemo(() => {
    const investment = Number(data?.metrics?.total_budget || 0);
    const revenue = chartData.at(-1)?.revenue || 0;
    const recoveryRate = investment > 0 ? (revenue / investment) * 100 : null;
    return {
      investment,
      revenue,
      recoveryRate,
      outstanding: Math.max(0, investment - revenue)
    };
  }, [chartData, data]);

  const statusSummaries = useMemo(() => (
    [
      { status: 'break_even', label: 'คืนทุนแล้ว', detail: 'รายได้สะสมตั้งแต่ 100%', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
      { status: 'near_break_even', label: 'ใกล้คืนทุน', detail: 'รายได้สะสม 70–99%', className: 'border-amber-200 bg-amber-50 text-amber-700' },
      { status: 'needs_attention', label: 'ต้องติดตาม', detail: 'รายได้สะสมต่ำกว่า 70%', className: 'border-rose-200 bg-rose-50 text-rose-700' },
      { status: 'missing_budget', label: 'ไม่มีงบลงทุน', detail: 'ยังประเมินอัตราคืนทุนไม่ได้', className: 'border-slate-200 bg-slate-100 text-slate-700' }
    ].map(item => ({
      ...item,
      branchCount: new Set((data?.projects || [])
        .filter(project => project.status === item.status)
        .map(project => project.pwa_code || normalizeBranchName(project.branch_name))
        .filter(Boolean)).size,
      projectCount: (data?.projects || []).filter(project => project.status === item.status).length
    }))
  ), [data]);

  const activeStatusSummary = statusSummaries.find(item => item.status === statusFilter);

  const allFilteredProjects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (data?.projects || []).filter(project => [
      project.project_code,
      project.contract_no,
      project.project_name,
      project.branch_name
    ].some(value => String(value || '').toLowerCase().includes(keyword)) && (
      statusFilter === 'all' || project.status === statusFilter
    ));
  }, [data, search, statusFilter]);

  useEffect(() => {
    setProjectPage(1);
  }, [branch, search, statusFilter, type, year, zone]);

  useEffect(() => {
    if (statusFilter !== 'all') {
      requestAnimationFrame(() => statusDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [statusFilter]);

  const showProjectsByStatus = (status) => {
    setStatusFilter(status);
    setProjectPage(1);
  };

  const projectsByBranch = useMemo(() => {
    const groups = allFilteredProjects.reduce((result, project) => {
      const normalizedBranchName = normalizeBranchName(project.branch_name);
      const branchDetail = branchDetails.get(String(project.pwa_code || '')) || branchDetailsByName.get(normalizedBranchName);
      const branchName = branchDetail?.branch_name || normalizedBranchName || 'ไม่ระบุสาขา';
      const branchKey = `branch:${normalizeBranchName(branchName)}:${branchDetail?.zone ?? ''}`;
      if (!result[branchKey]) result[branchKey] = { key: branchKey, branchName, ba: branchDetail?.ba, zone: branchDetail?.zone, projects: [] };
      result[branchKey].projects.push(project);
      return result;
    }, {});
    return Object.values(groups)
      .map(group => ({ ...group, zoneColor: ZONE_TEXT_COLORS[group.zone] || 'text-slate-500' }))
      .sort((a, b) => String(a.ba || '').localeCompare(String(b.ba || ''), undefined, { numeric: true }));
  }, [allFilteredProjects, branchDetails, branchDetailsByName]);

  const projectTotalPages = Math.max(1, Math.ceil(projectsByBranch.length / projectsPerPage));
  const currentProjectPage = Math.min(projectPage, projectTotalPages);
  const visibleProjectsByBranch = useMemo(() => {
    const startIndex = (currentProjectPage - 1) * projectsPerPage;
    return projectsByBranch.slice(startIndex, startIndex + projectsPerPage);
  }, [currentProjectPage, projectsByBranch]);

  // Retained for the legacy hidden table while the grouped display paginates by branch.
  const filteredProjects = allFilteredProjects;

  const metrics = data?.metrics;

  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-bold text-slate-600">กปภ.เขต
            <select value={zone} onChange={event => { setZone(event.target.value); setBranch('all'); }} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <option value="all">ทุกเขต</option>
              {PWA_ZONES.map(item => <option key={item} value={item}>{formatPwaZone(item)}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">กปภ.สาขา
            <select value={branch} disabled={zone === 'all'} onChange={event => setBranch(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100">
              <option value="all">{zone === 'all' ? 'เลือกเขตก่อน' : 'ทุกสาขา'}</option>
              {availableBranches.map(item => <option key={item.pwa_code || item.id} value={item.pwa_code}>{item.branch_name}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">ประเภทโครงการ
            <select value={type} onChange={event => setType(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <option value="all">ทุกประเภท</option>
              <option value="1">เงินรายได้</option><option value="2">เงินอุดหนุน</option><option value="3">กระตุ้นเศรษฐกิจ</option><option value="4">วางท่อเข้าซอย</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">ปีเริ่มโครงการ
            <select value={year} onChange={event => setYear(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <option value="all">ทุกปี</option>
              {availableYears.map(item => <option key={item} value={item}>พ.ศ. {item}</option>)}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-28 text-pwa-blue-dark shadow-sm"><RefreshCw className="mb-3 h-10 w-10 animate-spin" /><p className="text-sm font-bold">กำลังวิเคราะห์ข้อมูลการลงทุน...</p></div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700"><TriangleAlert className="mb-2 h-6 w-6" /><p className="font-bold">{error}</p></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="งบประมาณลงทุน" value={`${number(metrics.total_budget / 1000000, 2)} ลบ.`} detail={`${number(metrics.project_count)} โครงการ`} icon={<CircleDollarSign />} tone="blue" />
            <MetricCard title="รายได้ค่าน้ำสะสม" value={`${number(metrics.total_revenue / 1000000, 2)} ลบ.`} detail={`น้ำจำหน่าย ${number(metrics.total_usage)} ลบ.ม.`} icon={<Droplets />} tone="emerald" />
            <MetricCard title="อัตราคืนทุนรวม" value={`${number(metrics.recovery_rate, 1)}%`} detail={`เหลือ ${number(metrics.outstanding_amount / 1000000, 2)} ลบ.`} icon={<TrendingUp />} tone="cyan" />
            <MetricCard title="คืนทุนแล้ว" value={`${number(metrics.break_even_count)} โครงการ`} detail={`ใกล้คืนทุน ${number(metrics.near_break_even_count)} โครงการ`} icon={<CheckCircle2 />} tone="emerald" />
            <MetricCard title="ต้องติดตาม" value={`${number(metrics.needs_attention_count)} โครงการ`} detail={`ไม่มีงบกำหนด ${number(metrics.missing_budget_count)} โครงการ`} icon={<TrendingDown />} tone="rose" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-800">รายได้สะสมเทียบเป้าหมายงบลงทุน</h3>
                  <p className="mt-1 text-xs text-slate-500">พื้นที่สีเขียวคือรายได้ค่าน้ำสะสม ส่วนเส้นประสีน้ำเงินคือจุดคืนทุน</p>
                </div>
                <div className={`rounded-xl px-3 py-2 text-right ${chartSummary.recoveryRate !== null && chartSummary.recoveryRate >= 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide">อัตราคืนทุนรวม</p>
                  <p className="text-lg font-black">{chartSummary.recoveryRate === null ? '-' : `${number(chartSummary.recoveryRate, 1)}%`}</p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 px-4 py-3"><p className="text-[10px] font-bold text-emerald-700">รายได้สะสมปัจจุบัน</p><p className="mt-1 font-black text-emerald-800">{number(chartSummary.revenue)} บาท</p></div>
                <div className="rounded-xl bg-blue-50 px-4 py-3"><p className="text-[10px] font-bold text-blue-700">งบลงทุนเป้าหมาย</p><p className="mt-1 font-black text-blue-800">{number(chartSummary.investment)} บาท</p></div>
                <div className="rounded-xl bg-slate-100 px-4 py-3"><p className="text-[10px] font-bold text-slate-600">ยอดคงเหลือเพื่อคืนทุน</p><p className="mt-1 font-black text-slate-800">{number(chartSummary.outstanding)} บาท</p></div>
              </div>

              <div className="h-72 rounded-xl border border-slate-100 bg-gradient-to-b from-emerald-50/50 to-white p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 18, left: 4, bottom: 12 }}>
                    <defs>
                      <linearGradient id="cumulativeRevenue" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe7e4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={28} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, Math.max(1, chartSummary.revenue, showInvestmentTarget ? chartSummary.investment : 0) * 1.1]} tick={{ fontSize: 10 }} tickFormatter={value => `${number(value / 1000000, 1)} ลบ.`} width={72} axisLine={false} tickLine={false} />
                    <Tooltip formatter={value => `${number(value)} บาท`} labelFormatter={label => `เดือน ${label}`} contentStyle={{ borderRadius: 12, border: '1px solid #d1fae5', fontSize: 12 }} />
                    {showInvestmentTarget && chartSummary.investment > 0 && <ReferenceLine y={chartSummary.investment} stroke="#0369a1" strokeDasharray="7 5" strokeWidth={2.5} label={{ value: 'เป้าหมายงบลงทุน', position: 'insideTopRight', fill: '#0369a1', fontSize: 11, fontWeight: 700 }} />}
                    <Area type="monotone" dataKey="revenue" name="รายได้ค่าน้ำสะสม" stroke="#059669" strokeWidth={3} fill="url(#cumulativeRevenue)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold text-slate-500"><div className="flex items-center gap-4"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />รายได้ค่าน้ำสะสม</span>{showInvestmentTarget && <span className="flex items-center gap-1.5"><i className="w-5 border-t-2 border-dashed border-sky-700" />เป้าหมายงบลงทุน</span>}</div><button type="button" onClick={() => setShowInvestmentTarget(value => !value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50">{showInvestmentTarget ? 'ซ่อนเป้าหมายงบลงทุน' : 'แสดงเป้าหมายงบลงทุน'}</button></div>
            </div>
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><BarChart3 className="h-9 w-9 text-pwa-blue" /><h3 className="mt-3 text-lg font-extrabold text-slate-800">ผลการประเมินรายสาขา</h3><p className="mt-1 text-sm text-slate-500">นับสาขาที่มีอย่างน้อย 1 โครงการในแต่ละเกณฑ์</p></div>
              </div>
              <div className="mt-6 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {statusSummaries.map(item => (
                  <button key={item.status} type="button" onClick={() => showProjectsByStatus(item.status)} className={`flex min-h-[88px] flex-col justify-between rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${item.className}`}>
                    <div className="flex items-center justify-between gap-3"><span className="text-sm font-extrabold">{item.label}</span><span className="text-3xl font-black leading-none">{item.branchCount.toLocaleString()} <small className="text-xs font-bold">สาขา</small></span></div>
                    <p className="mt-2 text-xs font-medium opacity-85">{item.projectCount.toLocaleString()} โครงการ · {item.detail}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {statusFilter !== 'all' && activeStatusSummary && (
            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs ${activeStatusSummary.className}`}>
              <span className="font-semibold">กำลังแสดงเฉพาะโครงการ: {activeStatusSummary.label}</span>
              <button type="button" onClick={() => setStatusFilter('all')} className="font-bold underline underline-offset-2">แสดงทั้งหมด</button>
            </div>
          )}
          <div ref={statusDetailsRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
              <div><h3 className="font-bold text-slate-800">รายละเอียดการคืนทุนรายโครงการ</h3><p className="text-xs text-slate-500">จัดกลุ่มตามสาขา กดที่ชื่อสาขาเพื่อเปิดดูโครงการ</p></div>
              <label className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหารหัส สัญญา สาขา หรือโครงการ" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></label>
            </div>
            <div className="space-y-3 p-4">
              {visibleProjectsByBranch.length > 0 ? visibleProjectsByBranch.map(group => (
                <details key={group.key} open={statusFilter !== 'all'} className="overflow-hidden rounded-xl border border-slate-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-100"><span>{group.branchName} <span className={group.zoneColor}>(เขต {group.zone ?? '-'})</span></span><span className="rounded-full bg-blue-100 px-3 py-1 text-pwa-blue"><strong className="text-lg leading-none">{group.projects.length.toLocaleString()}</strong><span className="ml-1 text-xs font-bold">โครงการ</span></span></summary>
                  <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-y border-slate-100 bg-white text-slate-500"><tr><th className="px-5 py-3 font-bold">โครงการ</th><th className="px-5 py-3 text-right font-bold">งบลงทุน</th><th className="px-5 py-3 text-right font-bold">น้ำจำหน่ายสะสม</th><th className="px-5 py-3 text-right font-bold">รายได้ค่าน้ำสะสม</th><th className="px-5 py-3 text-right font-bold">คืนทุน</th><th className="px-5 py-3 text-right font-bold">คงเหลือ</th><th className="px-5 py-3 text-center font-bold">สถานะ</th></tr></thead><tbody className="divide-y divide-slate-100 text-slate-700">{group.projects.map(project => { const info = statusInfo[project.status]; return <tr key={project.project_code} className="hover:bg-blue-50/40"><td className="max-w-sm px-5 py-4"><p className="font-bold text-slate-800">{project.project_code}</p><p className="mt-1 truncate text-slate-500" title={project.project_name}>{project.project_name}</p><p className="mt-1 font-mono text-[10px] text-blue-600">{project.contract_no || '-'}</p></td><td className="px-5 py-4 text-right font-bold">{number(project.budget)}</td><td className="px-5 py-4 text-right text-blue-700">{number(project.total_usage)}</td><td className="px-5 py-4 text-right font-bold text-emerald-700">{number(project.total_amount)}</td><td className="px-5 py-4 text-right font-extrabold">{project.recovery_rate === null ? '-' : `${number(project.recovery_rate, 1)}%`}</td><td className="px-5 py-4 text-right font-semibold text-slate-600">{project.recovery_rate === null ? '-' : number(project.outstanding_amount)}</td><td className="px-5 py-4 text-center"><span className={`inline-flex rounded-full border px-2.5 py-1 font-bold ${info.className}`}>{info.label}</span></td></tr>; })}</tbody></table></div>
                </details>
              )) : <p className="py-10 text-center text-sm text-slate-400">ไม่พบโครงการตามเงื่อนไขที่เลือก</p>}
            </div>
          </div>
          <div className="hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><h3 className="font-bold text-slate-800">รายละเอียดการคืนทุนรายโครงการ</h3><p className="text-xs text-slate-500">เรียงตามรายได้ค่าน้ำสะสม และแสดงเฉพาะข้อมูลที่ผู้ดูแลระบบเห็นได้</p></div><label className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหารหัส สัญญา สาขา หรือโครงการ" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></label></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3 font-bold">โครงการ</th><th className="px-5 py-3 font-bold">สาขา</th><th className="px-5 py-3 text-right font-bold">งบลงทุน</th><th className="px-5 py-3 text-right font-bold">น้ำจำหน่ายสะสม</th><th className="px-5 py-3 text-right font-bold">รายได้ค่าน้ำสะสม</th><th className="px-5 py-3 text-right font-bold">คืนทุน</th><th className="px-5 py-3 text-right font-bold">คงเหลือ</th><th className="px-5 py-3 text-center font-bold">สถานะ</th></tr></thead><tbody className="divide-y divide-slate-100 text-slate-700">{filteredProjects.map(project => { const info = statusInfo[project.status]; return <tr key={project.project_code} className="hover:bg-blue-50/40"><td className="max-w-sm px-5 py-4"><p className="font-bold text-slate-800">{project.project_code}</p><p className="mt-1 truncate text-slate-500" title={project.project_name}>{project.project_name}</p><p className="mt-1 font-mono text-[10px] text-blue-600">{project.contract_no || '-'}</p></td><td className="px-5 py-4 font-semibold">{project.branch_name}</td><td className="px-5 py-4 text-right font-bold">{number(project.budget)}</td><td className="px-5 py-4 text-right text-blue-700">{number(project.total_usage)}</td><td className="px-5 py-4 text-right font-bold text-emerald-700">{number(project.total_amount)}</td><td className="px-5 py-4 text-right font-extrabold">{project.recovery_rate === null ? '-' : `${number(project.recovery_rate, 1)}%`}</td><td className="px-5 py-4 text-right font-semibold text-slate-600">{project.recovery_rate === null ? '-' : number(project.outstanding_amount)}</td><td className="px-5 py-4 text-center"><span className={`inline-flex rounded-full border px-2.5 py-1 font-bold ${info.className}`}>{info.label}</span></td></tr>; })}{filteredProjects.length === 0 && <tr><td colSpan="8" className="px-5 py-12 text-center text-slate-400">ไม่พบโครงการตามเงื่อนไขที่เลือก</td></tr>}</tbody></table></div>
          </div>
          {projectsByBranch.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">
              <span>แสดงหน้า {currentProjectPage} จาก {projectTotalPages} (ทั้งหมด {projectsByBranch.length.toLocaleString()} สาขา, {allFilteredProjects.length.toLocaleString()} โครงการ)</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentProjectPage === 1}
                  onClick={() => setProjectPage(page => Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ก่อนหน้า
                </button>
                <button
                  type="button"
                  disabled={currentProjectPage === projectTotalPages}
                  onClick={() => setProjectPage(page => Math.min(projectTotalPages, page + 1))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MetricCard({ title, value, detail, icon, tone }) {
  const tones = { blue: 'bg-blue-100 text-blue-700', emerald: 'bg-emerald-100 text-emerald-700', cyan: 'bg-cyan-100 text-cyan-700', rose: 'bg-rose-100 text-rose-700' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-2 text-2xl font-black text-slate-800">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div><div className={`rounded-xl p-3 ${tones[tone]}`}>{icon}</div></div></div>;
}
