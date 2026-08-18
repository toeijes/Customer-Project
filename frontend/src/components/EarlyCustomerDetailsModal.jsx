const MONTH_NAMES_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const formatThaiDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return '-';
  const str = String(dateStr).trim();
  
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 2400) year += 543;
      const monthName = MONTH_NAMES_TH[mIdx] || parts[1];
      if (!isNaN(day) && monthName && !isNaN(year)) {
        return `${day} ${monthName} ${year}`;
      }
    }
  }

  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) {
      let year = parseInt(parts[0], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (year < 2400) year += 543;
      const monthName = MONTH_NAMES_TH[mIdx] || parts[1];
      if (!isNaN(day) && monthName && !isNaN(year)) {
        return `${day} ${monthName} ${year}`;
      }
    }
  }
  
  if (/^\d{6}$/.test(str)) {
    const year = 2500 + parseInt(str.substring(0, 2), 10);
    const mIdx = parseInt(str.substring(2, 4), 10) - 1;
    const day = parseInt(str.substring(4, 6), 10);
    const monthName = MONTH_NAMES_TH[mIdx] || str.substring(2, 4);
    return `${day} ${monthName} ${year}`;
  }

  if (/^\d{8}$/.test(str)) {
    let year = parseInt(str.substring(0, 4), 10);
    const mIdx = parseInt(str.substring(4, 6), 10) - 1;
    const day = parseInt(str.substring(6, 8), 10);
    if (year < 2400) year += 543;
    const monthName = MONTH_NAMES_TH[mIdx] || str.substring(4, 6);
    return `${day} ${monthName} ${year}`;
  }

  return str;
};

import { useCallback, useEffect, useState } from 'react';
import { X, Users, AlertTriangle, Search, Loader2 } from 'lucide-react';

export default function EarlyCustomerDetailsModal({ isOpen, onClose, project }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCustomers = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.project_code}/early-customers`);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      } else {
        console.error('Failed to fetch early customers');
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
    setLoading(false);
  }, [project]);

  useEffect(() => {
    if (!isOpen || !project) return undefined;

    const requestId = window.setTimeout(() => {
      fetchCustomers();
    }, 0);

    return () => window.clearTimeout(requestId);
  }, [isOpen, project, fetchCustomers]);

  if (!isOpen || !project) return null;

  const filteredCustomers = customers.filter(c => {
    if (!searchTerm) return true;
    const matchCode = c.custcode ? String(c.custcode).includes(searchTerm) : false;
    const matchName = c.custname ? String(c.custname).toLowerCase().includes(searchTerm.toLowerCase()) : false;
    return matchCode || matchName;
  });

  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 p-5 border-b border-orange-200 flex justify-between items-start">
          <div className="flex gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm text-orange-600 border border-orange-100 flex-shrink-0">
              <Users size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                รายชื่อผู้ใช้น้ำที่ติดตั้งก่อนโครงการแล้วเสร็จ
              </h2>
              <div className="text-sm font-medium text-slate-600 mt-1 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200 font-bold">
                  {project.project_code}
                </span>
                {project.project_name}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-hidden flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <AlertTriangle size={16} className="text-amber-500" />
              พบลูกค้า <strong className="text-slate-800 text-base">{customers.length}</strong> ราย
            </div>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="ค้นหารหัส หรือชื่อผู้ใช้น้ำ..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-pwa-blue focus:ring-2 focus:ring-pwa-blue/20 transition-all outline-none"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full min-w-[1000px] text-sm text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 font-semibold text-center border-r border-slate-200 w-12">#</th>
                    <th className="p-3 font-semibold border-r border-slate-200">รหัสผู้ใช้น้ำ</th>
                    <th className="p-3 font-semibold border-r border-slate-200">ชื่อ - สกุล</th>
                    <th className="p-3 font-semibold border-r border-slate-200 text-center">วันที่ติดตั้ง</th>
                    <th className="p-3 font-semibold border-r border-slate-200 text-center">สาขา</th>
                    <th className="p-3 font-semibold text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-pwa-blue" />
                          <span className="font-medium">กำลังโหลดข้อมูล...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">
                        ไม่พบข้อมูลที่ค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c, idx) => (
                      <tr key={c.custcode} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-medium border-r border-slate-100">{idx + 1}</td>
                        <td className="p-3 font-bold text-pwa-blue border-r border-slate-100">{c.custcode}</td>
                        <td className="p-3 text-slate-700 border-r border-slate-100">{c.custname}</td>
                        <td className="p-3 text-center text-slate-600 border-r border-slate-100 font-medium">
                          {c.bgn_date ? formatThaiDate(c.bgn_date) : formatThaiDate(c.contrac_date)}
                        </td>
                        <td className="p-3 text-center text-slate-600 border-r border-slate-100 text-xs">
                          {c.branch_name || c.ba}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                            c.custstat === '1' ? 'bg-emerald-100 text-emerald-700' : 
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {c.custstat === '1' ? 'ปกติ' : 'ยกเลิก/ระงับ'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
