import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Search, ShieldAlert, LogIn, LogOut, UserCog, UserCheck, UserX } from 'lucide-react';

// ดึง Base URL ของ API หลังบ้าน
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/**
 * Component: SystemLogs
 * หน้าจอแสดงประวัติบันทึกการกระทำต่าง ๆ ที่เกิดขึ้นในระบบ (Audit Trail / System Logs)
 * อนุญาตให้ Admin ตรวจดูประวัติกิจกรรมการล็อกอิน การเปลี่ยนสิทธิ์ หรือเปลี่ยนสถานะผู้ใช้อื่น ๆ
 */
export default function SystemLogs({ currentUser, users, branchesFull = [] }) {
  // --- React States ---
  const [logs, setLogs] = useState([]);         // รายการ Log ทั้งหมดที่ได้จากระบบหลังบ้าน
  const [loading, setLoading] = useState(true);   // สถานะกำลังโหลดข้อมูลจาก API
  const [error, setError] = useState(null);       // ข้อความข้อผิดพลาดกรณีดึงข้อมูลล้มเหลว
  const [searchTerm, setSearchTerm] = useState(''); // คำค้นหาทั่วไป (เช่น ค้นตามรหัสพนักงาน หรือกิจกรรม)
  const [searchDate, setSearchDate] = useState(''); // วันที่ต้องการค้นหาประวัติ
  const [filterRole, setFilterRole] = useState('all'); // ตัวกรองระดับสิทธิ์ผู้ใช้งาน
  const [filterZone, setFilterZone] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 }); // สถานะการแบ่งหน้า

  // ดึงข้อมูล Logs เมื่อ Component ถูก Mount ขึ้นมาครั้งแรก
  useEffect(() => {
    fetchLogs(1);
  }, []);

  /**
   * fetchLogs
   * ฟังก์ชันเรียก API ดึงประวัติกิจกรรมระบุหน้า (Pagination)
   * 
   * @param {Number} page - หน้าของข้อมูลที่ต้องการดึง
   */
  const fetchLogs = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      // เรียก endpoint logs ของระบบผู้ดูแลระบบ
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

  /**
   * getActionIcon
   * เลือกแสดงไอคอน Lucide-react ที่เหมาะสมตามกิจกรรมที่ผู้ใช้กระทำ
   */
  const getActionIcon = (action) => {
    switch (action) {
      case 'LOGIN': return <LogIn className="w-4 h-4 text-emerald-500" />;
      case 'LOGOUT': return <LogOut className="w-4 h-4 text-slate-500" />;
      case 'UPDATE_ROLE': return <ShieldAlert className="w-4 h-4 text-amber-500" />;
      case 'UPDATE_STATUS': return <UserCog className="w-4 h-4 text-blue-500" />;
      default: return <Activity className="w-4 h-4 text-pwa-blue" />;
    }
  };

  /**
   * getActionLabel
   * แปลงชื่อกิจกรรม (Action String) ให้เป็นป้ายข้อความ (Badge Label) ภาษาไทยที่อ่านง่ายและมีสีสันระบุชัดเจน
   */
  const getActionLabel = (action) => {
    switch (action) {
      case 'LOGIN': return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">เข้าสู่ระบบ</span>;
      case 'LOGOUT': return <span className="text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">ออกจากระบบ</span>;
      case 'UPDATE_ROLE': return <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">เปลี่ยนสิทธิ์</span>;
      case 'UPDATE_STATUS': return <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">เปลี่ยนสถานะบัญชี</span>;
      default: return <span className="text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">{action}</span>;
    }
  };

  /**
   * formatDateTime
   * แปลงวันเวลา ISO format จากหลังบ้าน ให้เป็นวันเวลาแบบไทย (toLocaleString 'th-TH')
   */
  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString('th-TH', { 
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  /**
   * formatDetails
   * ฟังก์ชันจัดรูปแบบ JSON `details` ที่เก็บรายละเอียดของกิจกรรมแต่ละอัน เพื่อให้แสดงผลเป็นลิสต์อ่านง่ายบนตาราง
   * 
   * @param {String} action - ประเภทกิจกรรม
   * @param {String} target_id - รหัสเป้าหมายที่ได้รับผลกระทบ (เช่น User ID)
   * @param {Object} details - รายละเอียดเชิงลึกในรูปแบบ JSON object
   */
  const formatDetails = (action, target_id, details) => {
    let detailElements = [];

    // หากมีระบุรหัสเป้าหมายที่ได้รับผลกระทบ ให้ขึ้นหัวข้อไว้ก่อน
    if (target_id) {
      detailElements.push(
        <div key="target" className="flex gap-2">
          <span className="font-semibold text-slate-700 min-w-[80px]">รหัสเป้าหมาย:</span>
          <span className="text-slate-600">{target_id}</span>
        </div>
      );
    }

    if (!details) {
      if (detailElements.length === 0) return <span className="text-slate-400">-</span>;
      return <div className="space-y-1">{detailElements}</div>;
    }

    // จัดระเบียบการจัดแสดงรายละเอียดแยกตามประเภท Action
    if (action === 'LOGIN') {
      detailElements.push(
        <div key="strategy" className="flex gap-2">
          <span className="font-semibold text-slate-700 min-w-[80px]">ช่องทาง:</span>
          <span className="text-slate-600">{details.strategy === 'pwa' ? 'PWA API' : 'Local'}</span>
        </div>
      );
    } else if (action === 'UPDATE_STATUS') {
      detailElements.push(
        <div key="status" className="flex gap-2 items-center">
          <span className="font-semibold text-slate-700 min-w-[80px]">สถานะบัญชี:</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${details.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {details.isActive ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'}
          </span>
        </div>
      );
    } else if (action === 'UPDATE_ROLE') {
      if (details.role_name) {
        detailElements.push(
          <div key="role_name" className="flex gap-2">
            <span className="font-semibold text-slate-700 min-w-[80px]">สิทธิ์ที่ได้รับ:</span>
            <span className="text-slate-600">{details.role_name}</span>
          </div>
        );
      }
    } else if (action === 'CREATE_ROLE' || action === 'UPDATE_ROLE_INFO' || action === 'DELETE_ROLE') {
       if (details.name || details.role_name) {
         detailElements.push(
           <div key="name" className="flex gap-2">
             <span className="font-semibold text-slate-700 min-w-[80px]">ชื่อกลุ่มสิทธิ์:</span>
             <span className="text-slate-600">{details.name || details.role_name}</span>
           </div>
         );
       }
       if (details.level !== undefined) {
         detailElements.push(
           <div key="level" className="flex gap-2">
             <span className="font-semibold text-slate-700 min-w-[80px]">ระดับ:</span>
             <span className="text-slate-600">{details.level}</span>
           </div>
         );
       }
    } else {
      // สำหรับกิจกรรมอื่น ๆ ที่ไม่ได้ระบุเงื่อนไขไว้ ให้วนลูปคู่ key-value ออกมาแสดงผลทั้งหมด
      Object.entries(details).forEach(([key, value]) => {
         detailElements.push(
            <div key={key} className="flex gap-2">
              <span className="font-semibold text-slate-700 min-w-[80px]">{key}:</span>
              <span className="text-slate-600">{String(value)}</span>
            </div>
         );
      });
    }

    return <div className="space-y-1">{detailElements}</div>;
  };

  /**
   * getUserTooltip
   * ดึงข้อมูลผู้ใช้งานมาแสดงเป็น Tooltip เมื่อเอาเมาส์ชี้ที่ชื่อ
   */
  const getUserTooltip = (userId) => {
    if (!userId || !users) return '';
    const user = users.find(u => u.id === userId);
    if (!user) return '';
    
    const parts = [];
    if (user.position) parts.push(`ตำแหน่ง: ${user.position}`);
    if (user.job_name) parts.push(`งาน: ${user.job_name}`);
    if (user.div_name) parts.push(`กอง/สาขา: ${user.div_name}`);
    if (user.dep_name) parts.push(`ฝ่าย: ${user.dep_name}`);
    
    return parts.join('\n');
  };

  /**
   * การทำ Client-side filtering
   * กรองประวัติกิจกรรมตามคำค้นหา (ค้นหาด้วย username, action, target_id) และวันที่ทำรายการ
   */
  const filteredLogs = logs.filter(log => {
    let matchText = true;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      matchText = (log.username || '').toLowerCase().includes(term) ||
             (log.action || '').toLowerCase().includes(term) ||
             (log.target_id || '').toLowerCase().includes(term);
    }
    
    let matchDate = true;
    if (searchDate) {
      // created_at เป็นวันเวลา UTC ใน ISO string จึงแปลงมาเป็นวันที่แบบโลคอลในฟอร์แมต YYYY-MM-DD เพื่อเปรียบเทียบ
      const logDateLocal = new Date(log.created_at).toLocaleDateString('en-CA'); // คืนค่าเป็น YYYY-MM-DD
      matchDate = (logDateLocal === searchDate);
    }

    let matchRole = true;
    if (filterRole !== 'all') {
      if (filterRole === 'admin') {
        matchRole = log.role_level === 100 || (log.role_name || '').toLowerCase() === 'admin';
      } else if (filterRole === 'Planning') {
        matchRole = log.role_level === 50 || (log.role_name || '').toLowerCase() === 'planning';
      } else if (filterRole === 'user') {
        matchRole = log.role_level === 0 || (log.role_name || '').toLowerCase() === 'user';
      } else if (filterRole === 'system') {
        matchRole = log.user_id === null || log.role_level === null;
      }
    }

    let matchZone = true;
    if (currentUser?.role === 'RegAdmin') {
      matchZone = String(log.area) === String(currentUser?.area);
    } else if (filterZone !== 'all') {
      const logArea = String(log.area) === '99' ? '11' : String(log.area);
      matchZone = logArea === String(filterZone);
    }

    let matchBranch = true;
    if (filterBranch !== 'all') {
      matchBranch = String(log.ba) === String(filterBranch);
    }
    
    return matchText && matchDate && matchRole && matchZone && matchBranch;
  });

  const uniqueZones = [...new Set(branchesFull.map(b => b.zone))].filter(Boolean).sort((a, b) => a - b);
  const availableBranches = branchesFull.filter(b => {
    if (b.branch_name.startsWith('การประปาส่วนภูมิภาคเขต')) return false;
    if (currentUser?.role === 'RegAdmin') return String(b.zone) === String(currentUser?.area);
    if (filterZone !== 'all') return String(b.zone) === String(filterZone);
    return true;
  }).sort((a, b) => String(a.ba).localeCompare(String(b.ba)));

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ส่วนเครื่องมือจัดการด้านบน (Table Toolbar): ค้นหา, กรองวันที่ และปุ่ม Refresh */}
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
          <div className="flex gap-2 flex-1 sm:w-auto">
            {/* ช่องค้นหา */}
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
            {/* ช่องเลือกกรองวันที่ */}
            <input 
              type="date" 
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue transition shadow-sm cursor-pointer"
              title="ค้นหาตามวันที่"
            />
            {/* ช่องเลือกกรองระดับสิทธิ์ */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue transition shadow-sm cursor-pointer bg-white"
              title="กรองตามระดับสิทธิ์"
            >
              <option value="all">ทุกระดับสิทธิ์</option>
              {(currentUser?.role !== 'RegAdmin' || (users || []).some(u => u.role === 'admin' || (u.roles && u.roles.some(r => r.name.toLowerCase() === 'admin')))) && (
                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
              )}
              <option value="Planning">เจ้าหน้าที่แผนงาน (Planning)</option>
              <option value="user">ผู้ใช้งานทั่วไป (User)</option>
              {currentUser?.role !== 'RegAdmin' && (
                <option value="system">ระบบ/อื่นๆ</option>
              )}
            </select>
            {/* ช่องกรองตามเขต (Admin เท่านั้น) */}
            {currentUser?.role !== 'RegAdmin' && (
              <select
                value={filterZone}
                onChange={(e) => {
                  setFilterZone(e.target.value);
                  setFilterBranch('all');
                }}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue transition shadow-sm cursor-pointer bg-white"
                title="กรองตามเขต"
              >
                <option value="all">ทุกเขต</option>
                {uniqueZones.map(z => (
                  <option key={z} value={z}>{String(z) === '11' ? 'ส่วนกลาง' : `เขต ${z}`}</option>
                ))}
              </select>
            )}
            {/* ช่องกรองตามสาขา */}
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              disabled={currentUser?.role !== 'RegAdmin' && filterZone === 'all'}
              className={`px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue transition shadow-sm ${(currentUser?.role !== 'RegAdmin' && filterZone === 'all') ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-70' : 'bg-white cursor-pointer'}`}
              title="กรองตามสาขา"
            >
              <option value="all">
                {(currentUser?.role !== 'RegAdmin' && filterZone === 'all') ? '-- เลือกเขตก่อน --' : 'ทุกสาขา'}
              </option>
              {(currentUser?.role === 'RegAdmin' || filterZone !== 'all') && availableBranches.map(b => (
                <option key={b.ba} value={b.ba}>{b.branch_name}</option>
              ))}
            </select>
          </div>
          {/* ปุ่มดึงข้อมูลใหม่ (Refresh) */}
          <button onClick={() => fetchLogs(1)} className="p-2 text-slate-500 hover:text-pwa-blue hover:bg-pwa-blue-light rounded-xl border border-slate-200 transition shadow-sm" title="รีเฟรช">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-pwa-blue' : ''}`} />
          </button>
        </div>
      </div>

      {/* แสดง Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* ส่วนตารางข้อมูลประวัติระบบ */}
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
                  {/* แสดงวันเวลาไทย */}
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {formatDateTime(log.created_at)}
                  </td>
                  {/* ชื่อผู้ใช้ (username) และบทบาท/ระดับสิทธิ์ */}
                  <td className="px-6 py-4">
                    <div 
                      className="font-bold text-slate-800 cursor-help" 
                      title={getUserTooltip(log.user_id)}
                    >
                      {log.username}
                    </div>
                    {log.role_name ? (
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          log.role_level === 100 || log.role_name.toLowerCase() === 'admin' 
                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                            : log.role_level === 50 || log.role_name.toLowerCase() === 'planning'
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : 'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                          {log.role_level === 100 || log.role_name.toLowerCase() === 'admin' 
                            ? 'Admin'
                            : log.role_level === 50 || log.role_name.toLowerCase() === 'planning'
                            ? 'Planning'
                            : 'User'}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-100">
                          System / Other
                        </span>
                      </div>
                    )}
                  </td>
                  {/* ป้ายแสดงกิจกรรมและไอคอน */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      {getActionLabel(log.action)}
                    </div>
                  </td>
                  {/* รายละเอียดเพิ่มเติม */}
                  <td className="px-6 py-4 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg min-w-[200px] border border-slate-100 shadow-sm">
                      {formatDetails(log.action, log.target_id, log.details)}
                    </div>
                  </td>
                  {/* IP Address */}
                  <td className="px-6 py-4 text-right text-xs text-slate-400 font-mono">
                    {log.ip_address || '-'}
                  </td>
                </tr>
              ))}
              
              {/* ไม่พบข้อมูล */}
              {!loading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    ไม่พบข้อมูลประวัติการใช้งาน
                  </td>
                </tr>
              )}
              {/* ขณะกำลังดาวน์โหลด */}
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
        
        {/* ส่วนปุ่มแบ่งหน้า (Pagination Controls) */}
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
