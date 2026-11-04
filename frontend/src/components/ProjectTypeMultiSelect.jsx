import { PROJECT_TYPE_OPTIONS, selectedProjectTypes } from '../projectTypes';

export default function ProjectTypeMultiSelect({ value, onChange, className = '' }) {
  const selected = selectedProjectTypes(value);
  const allSelected = selected.length === PROJECT_TYPE_OPTIONS.length;

  const toggle = type => {
    const next = selected.includes(type)
      ? selected.filter(item => item !== type)
      : [...selected, type];
    if (next.length === 0) return;
    onChange(next.length === PROJECT_TYPE_OPTIONS.length ? 'all' : next.sort((a, b) => Number(a) - Number(b)).join(','));
  };

  return <details className={`relative ${className}`}>
    <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
      {allSelected ? 'ทุกประเภท' : `เลือกแล้ว ${selected.length} ประเภท`} ▾
    </summary>
    <div className="absolute left-0 top-full z-50 mt-1 min-w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <button type="button" onClick={() => onChange('all')} className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-pwa-blue hover:bg-blue-50">ทุกประเภท</button>
      {PROJECT_TYPE_OPTIONS.map(({ value: type, label }) => <label key={type} className="flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
        <input type="checkbox" checked={selected.includes(type)} onChange={() => toggle(type)} className="mt-1" />
        <span>{type}. {label}</span>
      </label>)}
    </div>
  </details>;
}
