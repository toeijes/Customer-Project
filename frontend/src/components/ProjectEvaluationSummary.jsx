import { useEffect, useMemo, useState } from 'react';
import { Edit3, GitMerge, RefreshCw, Search, Trash2, Users, Wallet } from 'lucide-react';
import { formatPwaBranch, formatPwaZone } from '../pwaDisplay';

const number = value => Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });

export default function ProjectEvaluationSummary({ apiBase = '/api', user }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const assignedZone = String(user?.area || '').trim();
  const effectiveZone = isAdmin ? filterZone : assignedZone;

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const response = await fetch(`${apiBase}/project-evaluation-groups`, { credentials: 'include' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'ไม่สามารถดึงข้อมูลได้');
        const summaries = await Promise.all((payload.groups || []).map(async group => {
          const detailResponse = await fetch(`${apiBase}/project-evaluation-links?project_code=${encodeURIComponent(group.primary_project_code)}`, { credentials: 'include' });
          const detail = await detailResponse.json();
          if (!detailResponse.ok) throw new Error(detail.error || 'ไม่สามารถดึงรายละเอียดกลุ่มได้');
          return detail.group ? {
            ...detail.group,
            zone: group.zone,
            pwa_code: group.pwa_code,
            branch_name: group.branch_name
          } : null;
        }));
        if (active) setGroups(summaries.filter(Boolean));
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [apiBase, refreshKey]);

  const updateReason = async member => {
    const relationship_reason = window.prompt('แก้ไขเหตุผลการเชื่อมโยง', member.relationship_reason || '');
    if (relationship_reason === null) return;
    const response = await fetch(`${apiBase}/project-evaluation-links/${encodeURIComponent(member.project_code)}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relationship_reason }) });
    if (!response.ok) { const data = await response.json(); window.alert(data.error || 'ไม่สามารถบันทึกได้'); return; }
    setRefreshKey(key => key + 1);
  };
  const unlink = async member => {
    if (!window.confirm(`ต้องการถอด ${member.project_code} ออกจากกลุ่มประเมินหรือไม่?`)) return;
    const response = await fetch(`${apiBase}/project-evaluation-links/${encodeURIComponent(member.project_code)}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) { const data = await response.json(); window.alert(data.error || 'ไม่สามารถถอดได้'); return; }
    setRefreshKey(key => key + 1);
  };

  const zones = useMemo(() => [...new Set(groups.map(group => String(group.zone || '').trim()).filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b)), [groups]);

  const branches = useMemo(() => groups
    .filter(group => effectiveZone === 'all' || String(group.zone) === effectiveZone)
    .map(group => ({ pwaCode: String(group.pwa_code || ''), name: group.branch_name }))
    .filter(branch => branch.pwaCode && branch.name)
    .filter((branch, index, list) => list.findIndex(item => item.pwaCode === branch.pwaCode) === index)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'th')),
  [groups, effectiveZone]);

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return groups.filter(group => {
      const matchesZone = effectiveZone === 'all' || String(group.zone) === effectiveZone;
      const matchesBranch = filterBranch === 'all' || String(group.pwa_code) === filterBranch;
      const matchesSearch = !keyword || group.members.some(member => [
        member.project_code,
        member.contract_no,
        member.project_name,
        member.branch_name
      ].some(value => String(value || '').toLowerCase().includes(keyword)));
      return matchesZone && matchesBranch && matchesSearch;
    });
  }, [groups, search, effectiveZone, filterBranch]);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center text-slate-500"><RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-pwa-blue" />กำลังโหลดกลุ่มประเมินโครงการ...</div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div>;
  if (!groups.length) return <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center text-slate-500"><GitMerge className="mx-auto mb-3 h-10 w-10 text-slate-300" /><p className="font-bold">ยังไม่มีโครงการที่เชื่อมโยงกัน</p><p className="mt-1 text-xs">สร้างโครงการสมทบจากหน้าเพิ่มโครงการเพื่อเริ่มกลุ่มประเมิน</p></div>;

  return <section className="space-y-5 animate-fadeIn [&>div:nth-child(3)]:hidden">
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="text-2xl font-extrabold text-pwa-blue-dark">สรุปการเชื่อมโยงโครงการ</h2>
      <p className="text-right text-sm text-slate-500">เป้าหมายและงบลงทุนอ้างอิงโครงการหลัก ส่วนผลงานจริงและรายได้รวมทุกโครงการในกลุ่ม</p>
    </div>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <span className="px-1 text-xs font-bold text-slate-600">กรองข้อมูล:</span>
      {isAdmin ? <select value={filterZone} onChange={event => { setFilterZone(event.target.value); setFilterBranch('all'); }} className="min-w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-pwa-blue/20">
        <option value="all">ทุกเขต</option>
        {zones.map(zone => <option key={zone} value={zone}>{formatPwaZone(zone)}</option>)}
      </select> : <span className="min-w-32 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">{formatPwaZone(assignedZone) || 'เขตต้นสังกัด'}</span>}
      <select value={filterBranch} onChange={event => setFilterBranch(event.target.value)} disabled={!effectiveZone} className="min-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pwa-blue/20">
        <option value="all">{effectiveZone ? 'ทุกสาขา' : 'ไม่พบเขตต้นสังกัด'}</option>
        {branches.map(branch => <option key={branch.pwaCode} value={branch.pwaCode}>{formatPwaBranch(branch.name)}</option>)}
      </select>
      <label className="relative min-w-56 flex-1 sm:min-w-72">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหารหัส สัญญา สาขา หรือโครงการ" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-pwa-blue/20" />
      </label>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-extrabold text-pwa-blue-dark">สรุปการเชื่อมโยงโครงการ</h2><p className="mt-1 text-sm text-slate-500">เป้าหมายและงบลงทุนอ้างอิงโครงการหลัก ส่วนผลงานจริงและรายได้รวมทุกโครงการในกลุ่ม</p></div><label className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหารหัส สัญญา สาขา หรือโครงการ" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-pwa-blue/20" /></label></div>
    {filteredGroups.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">ไม่พบกลุ่มโครงการที่ตรงกับการค้นหา</div> :
    <div className="grid gap-5 xl:grid-cols-2">
      {filteredGroups.map(group => {
        const primary = group.members.find(member => member.member_role === 'primary');
        const contributors = group.members.filter(member => member.member_role === 'contributor');
        const summary = group.summary || {};
        return <article key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50 px-5 py-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-pwa-blue">โครงการหลัก</p><h3 className="mt-1 font-extrabold text-slate-800">{primary?.project_code} — {primary?.project_name}</h3><p className="mt-2 inline-flex rounded-md border border-blue-200 bg-white px-2.5 py-1 font-mono text-xs font-extrabold text-pwa-blue">เลขที่สัญญา: {primary?.contract_no || 'ไม่มีเลขที่สัญญา'}</p><p className="mt-2 text-xs text-slate-500">{primary?.branch_name} · ปีงบ {primary?.start_year}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-pwa-blue shadow-sm">เชื่อมโยง {contributors.length + 1} โครงการ</span></div></div>
          <div className="grid grid-cols-2 gap-px bg-slate-100"><Metric icon={<Users />} label="เป้าหมายจาก A" value={`${number(summary.target_users)} ราย`} /><Metric icon={<Users />} label="ผู้ใช้น้ำจริง A+B" value={`${number(summary.actual_users)} ราย`} /><Metric icon={<Wallet />} label="งบลงทุนจาก A" value={`${number(summary.budget)} บาท`} /><Metric icon={<Wallet />} label="รายได้สะสม A+B" value={`${number(summary.total_amount)} บาท`} /></div>
          <div className="grid grid-cols-2 gap-3 p-5 text-sm"><div><p className="text-xs text-slate-500">ผลสำเร็จรวม</p><p className="mt-1 text-xl font-black text-emerald-700">{Number(summary.achievement_rate || 0).toFixed(1)}%</p></div><div><p className="text-xs text-slate-500">จุดคุ้มทุนรวม</p><p className="mt-1 text-xl font-black text-pwa-blue">{Number(summary.recovery_rate || 0).toFixed(1)}%</p></div></div>
          <div className="border-t border-slate-100 px-5 py-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold text-slate-700">ผู้ใช้น้ำเกิดขึ้นจริง แยกตามโครงการ</p><p className="text-xs font-extrabold text-emerald-700">รวม {number(summary.actual_users)} ราย</p></div><div className="space-y-1.5">{group.members.map(member => <div key={member.project_code} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="truncate pr-3 text-slate-600"><strong className="text-slate-800">{member.member_role === 'primary' ? 'A (หลัก)' : 'สมทบ'}:</strong> {member.project_code} — {member.project_name}</span><span className="shrink-0 font-extrabold text-pwa-blue">{number(member.total_actual_users)} ราย</span></div>)}</div></div>
          {contributors.length > 0 && <div className="border-t border-slate-100 px-5 py-4"><p className="mb-2 text-xs font-bold text-slate-600">โครงการสมทบผลลัพธ์</p><div className="space-y-2">{contributors.map(member => <div key={member.project_code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><div><p className="font-semibold text-slate-700">{member.project_code} — {member.project_name}</p><p className="mt-1 font-mono font-bold text-pwa-blue">เลขที่สัญญา: {member.contract_no || 'ไม่มีเลขที่สัญญา'}</p></div><div className="flex items-center gap-2"><span className="text-slate-500">{member.relationship_reason || 'ไม่ระบุเหตุผล'}</span><button onClick={() => updateReason(member)} title="แก้ไขเหตุผล" className="rounded-md p-1 text-pwa-blue hover:bg-blue-100"><Edit3 className="h-3.5 w-3.5" /></button><button onClick={() => unlink(member)} title="ถอดจากกลุ่ม" className="rounded-md p-1 text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div></div>}
        </article>;
      })}
    </div>}
  </section>;
}

function Metric({ icon, label, value }) {
  return <div className="bg-white p-4"><div className="mb-2 text-pwa-blue">{icon}</div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>;
}
