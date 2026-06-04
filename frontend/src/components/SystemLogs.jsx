import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Search, ShieldAlert, LogIn, LogOut, UserCog, UserCheck, UserX } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/logs?page=${page}&limit=${pagination.limit}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      
      if (data.success) {
        setLogs(data.data);
        setPagination(data.pagination);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'LOGIN': return <LogIn className="w-4 h-4 text-emerald-500" />;
      case 'LOGOUT': return <LogOut className="w-4 h-4 text-slate-500" />;
      case 'UPDATE_ROLE': return <ShieldAlert className="w-4 h-4 text-amber-500" />;
      case 'UPDATE_STATUS': return <UserCog className="w-4 h-4 text-blue-500" />;
      default: return <Activity className="w-4 h-4 text-pwa-blue" />;
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'LOGIN': return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">เข้าสู่ระบบ</span>;
      case 'LOGOUT': return <span className="text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">ออกจากระบบ</span>;
      case 'UPDATE_ROLE': return <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">เปลี่ยนสิทธิ์</span>;
      case 'UPDATE_STATUS': return <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">เปลี่ยนสถานะบัญชี</span>;
      default: return <span className="text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">{action}</span>;
    }
  };

  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString('th-TH', { 
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (log.username || '').toLowerCase().includes(term) ||
           (log.action || '').toLowerCase().includes(term) ||
           (log.target_id || '').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Table Toolbar */}
      <div className="bg-white px-6 py-4 border border-slate-200 rounded-2xl shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pwa-blue-light/50 flex items-center justify-center text-pwa-blue-dark">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 font-display text-lg leading-tight">ประวัติการใช้งานระบบ</h3>
            <p className="text-xs text-slate-500">บันทึกการกระทำต่างๆ ที่เกิดขึ้นภายในระบบ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อ, การกระทำ..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue transition shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <button onClick={() => fetchLogs(1)} className="p-2 text-slate-500 hover:text-pwa-blue hover:bg-pwa-blue-light rounded-xl border border-slate-200 transition shadow-sm" title="รีเฟรช">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-pwa-blue' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">วัน-เวลา</th>
                <th className="px-6 py-4">ผู้กระทำ</th>
                <th className="px-6 py-4">การกระทำ</th>
                <th className="px-6 py-4">รายละเอียด</th>
                <th className="px-6 py-4 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{log.username}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      {getActionLabel(log.action)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="text-slate-600 font-mono bg-slate-50 p-2 rounded max-w-sm overflow-hidden text-ellipsis whitespace-nowrap" title={log.details ? JSON.stringify(log.details) : ''}>
                      {log.target_id && <span className="font-bold text-slate-800 block mb-0.5">Target ID: {log.target_id}</span>}
                      {log.details ? JSON.stringify(log.details) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-400 font-mono">
                    {log.ip_address || '-'}
                  </td>
                </tr>
              ))}
              {!loading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    ไม่พบข้อมูลประวัติการใช้งาน
                  </td>
                </tr>
              )}
              {loading && logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 text-pwa-blue animate-spin" />
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm text-slate-600">
            <div>
              แสดงหน้า {pagination.page} จาก {pagination.totalPages} (รวม {pagination.total} รายการ)
            </div>
            <div className="flex items-center gap-2">
              <button 
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="px-3 py-1.5 border border-slate-300 rounded hover:bg-white disabled:opacity-50 transition"
              >
                ก่อนหน้า
              </button>
              <button 
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="px-3 py-1.5 border border-slate-300 rounded hover:bg-white disabled:opacity-50 transition"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
