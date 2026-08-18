import { useMemo, useState } from 'react';
import { Eye, EyeOff, Save, UserPlus } from 'lucide-react';
import { PWA_ZONES, formatPwaBranch, formatPwaZone } from '../pwaDisplay';

const INITIAL_FORM = {
  username: '',
  password: '',
  confirmPassword: '',
  firstname: '',
  lastname: '',
  email: '',
  position: '',
  area: '',
  ba: ''
};

export default function LocalUserCreate({ branches = [], onCreated }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const availableBranches = useMemo(
    () => branches.filter(branch => (
      PWA_ZONES.includes(String(branch.zone))
      && !branch.branch_name.startsWith('การประปาส่วนภูมิภาคเขต')
      && (!form.area || String(branch.zone) === String(form.area))
    )),
    [branches, form.area]
  );

  const updateField = (field, value) => {
    setForm(current => ({
      ...current,
      [field]: value,
      ...(field === 'area' ? { ba: '' } : {})
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/users/local', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          firstname: form.firstname,
          lastname: form.lastname,
          email: form.email,
          position: form.position,
          area: form.area,
          ba: form.ba
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถเพิ่ม Local User ได้');
      }

      setForm(INITIAL_FORM);
      setSuccess(`เพิ่ม Local User ${data.data.username} สำเร็จ`);
      await onCreated?.();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-4xl">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <UserPlus className="h-5 w-5 text-pwa-blue" />
          เพิ่ม Local User
        </h2>
        <p className="mt-1 text-sm text-slate-500">บัญชีใหม่จะได้รับสิทธิ์ User และเปิดใช้งานทันที</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Username
          <input required minLength={3} maxLength={100} value={form.username} onChange={event => updateField('username', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-pwa-blue focus:outline-none focus:ring-2 focus:ring-pwa-blue/20" autoComplete="off" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Default Role
          <input value="User" disabled className="mt-2 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2.5 font-normal text-slate-500" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          ชื่อ
          <input required value={form.firstname} onChange={event => updateField('firstname', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-pwa-blue focus:outline-none focus:ring-2 focus:ring-pwa-blue/20" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          นามสกุล
          <input required value={form.lastname} onChange={event => updateField('lastname', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-pwa-blue focus:outline-none focus:ring-2 focus:ring-pwa-blue/20" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          รหัสผ่าน
          <span className="relative mt-2 block">
            <input required minLength={12} type={showPassword ? 'text' : 'password'} value={form.password} onChange={event => updateField('password', event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2.5 pr-10 font-normal focus:border-pwa-blue focus:outline-none focus:ring-2 focus:ring-pwa-blue/20" autoComplete="new-password" />
            <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500" title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          ยืนยันรหัสผ่าน
          <input required minLength={12} type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={event => updateField('confirmPassword', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-pwa-blue focus:outline-none focus:ring-2 focus:ring-pwa-blue/20" autoComplete="new-password" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Email
          <input type="email" value={form.email} onChange={event => updateField('email', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-pwa-blue focus:outline-none focus:ring-2 focus:ring-pwa-blue/20" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          ตำแหน่ง
          <input value={form.position} onChange={event => updateField('position', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 font-normal focus:border-pwa-blue focus:outline-none focus:ring-2 focus:ring-pwa-blue/20" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          เขต
          <select required value={form.area} onChange={event => updateField('area', event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal focus:border-pwa-blue focus:outline-none focus:ring-2 focus:ring-pwa-blue/20">
            <option value="">เลือกเขต</option>
            {PWA_ZONES.map(zone => <option key={zone} value={zone}>{formatPwaZone(zone)}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          สาขา (BA)
          <select value={form.ba} onChange={event => updateField('ba', event.target.value)} disabled={!form.area} className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100 focus:border-pwa-blue focus:outline-none focus:ring-2 focus:ring-pwa-blue/20">
            <option value="">ไม่ระบุ</option>
            {availableBranches.map(branch => <option key={`${branch.ba}-${branch.pwa_code}`} value={branch.ba}>{formatPwaBranch(branch.branch_name)}</option>)}
          </select>
        </label>

        <div className="md:col-span-2">
          {error && <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
          {success && <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p>}
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-md bg-pwa-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-pwa-blue-dark disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />
            {submitting ? 'กำลังบันทึก...' : 'เพิ่ม Local User'}
          </button>
        </div>
      </form>
    </section>
  );
}
