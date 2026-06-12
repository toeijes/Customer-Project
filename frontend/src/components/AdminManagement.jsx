import React, { useState, useEffect } from 'react';
import { Users, Shield, UserX, CheckCircle, Search, RefreshCw, Activity, ListOrdered } from 'lucide-react';
import SystemLogs from './SystemLogs';
import RoleManagement from './RoleManagement';

// Base URL สำหรับเรียก API
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/**
 * Component: AdminManagement
 * หน้าจอการจัดการระบบหลักสำหรับผู้ดูแลระบบ (Admin Console)
 * ทำหน้าที่เป็นหน้าจอควบคุมย่อย รวบรวมแท็บสำหรับ:
 * 1. รายชื่อผู้ใช้งาน (เปิด/ปิดบัญชี, เปลี่ยนแปลงระดับสิทธิ์)
 * 2. จัดการระดับสิทธิ์ (Role Management)
 * 3. ประวัติการใช้งานระบบ (System Audit Logs)
 * 
 * @param {Object} currentUser - ข้อมูลผู้ดูแลระบบที่กำลังเข้าสู่ระบบในปัจจุบัน (ใช้สำหรับเช็คสิทธิ์ตัวเองเพื่อความปลอดภัย)
 */
export default function AdminManagement({ currentUser }) {
  // --- React States ---
  const [users, setUsers] = useState([]);               // เก็บรายการบัญชีผู้ใช้ทั้งหมด
  const [roles, setRoles] = useState([]);               // เก็บคู่มือระดับสิทธิ์สิทธิ์ทั้งหมดที่มีในระบบ
  const [loading, setLoading] = useState(true);           // สถานะกำลังโหลดข้อมูลเริ่มต้นจาก API
  const [error, setError] = useState(null);               // ข้อความความผิดพลาดในการเรียก API
  const [searchTerm, setSearchTerm] = useState('');       // คำค้นหาสำหรับค้นหาผู้ใช้งาน (Username/ชื่อ/นามสกุล)
  const [isActionLoading, setIsActionLoading] = useState(false); // สถานะกำลังบันทึก/แก้ไขข้อมูลกับ API หลังบ้าน
  const [activeTab, setActiveTab] = useState('users');     // แท็บย่อยที่เลือกเปิดใช้งานอยู่ (users, roles, logs)

  // ดึงข้อมูลรายชื่อผู้ใช้และระดับสิทธิ์ทั้งหมดตั้งแต่เริ่มต้นโหลดหน้านี้
  useEffect(() => {
    fetchData();
  }, []);

  /**
   * fetchData
   * ดึงข้อมูลผู้ใช้งานและระดับสิทธิ์ทั้งหมดแบบขนานกัน (Parallel Request) โดยใช้ Promise.all
   */
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch(`/api/admin/users`, { credentials: 'include' }),
        fetch(`/api/admin/roles`, { credentials: 'include' })
      ]);

      if (!usersRes.ok) {
        const errData = await usersRes.json().catch(()=>({}));
        throw new Error(`Users API Error: ${usersRes.status} ${errData.error || usersRes.statusText}`);
      }
      if (!rolesRes.ok) {
        const errData = await rolesRes.json().catch(()=>({}));
        throw new Error(`Roles API Error: ${rolesRes.status} ${errData.error || rolesRes.statusText}`);
      }

      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();

      if (usersData.success) setUsers(usersData.data);
      if (rolesData.success) setRoles(rolesData.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * toggleUserActive
   * ฟังก์ชันสลับสถานะเปิดใช้งาน/ระงับ บัญชีผู้ใช้งาน
   * ป้องกันการระงับบัญชีของตัวเองเพื่อความปลอดภัย
   * 
   * @param {Number} userId - ไอดีของผู้ใช้งานที่ต้องการระงับ/เปิดสิทธิ์
   * @param {Boolean} currentStatus - สถานะการใช้งานในปัจจุบัน (true = ทำงานปกติ, false = ถูกระงับ)
   */
  const toggleUserActive = async (userId, currentStatus) => {
    // ป้องกันแอดมินระงับตัวเองโดยไม่ได้ตั้งใจ
    if (userId === currentUser?.id) {
      alert("คุณไม่สามารถระงับบัญชีของตนเองได้");
      return;
    }
    
    const newStatus = !currentStatus;
    if (!window.confirm(`คุณต้องการ ${newStatus ? 'เปิดใช้งาน' : 'ระงับ'} บัญชีนี้ใช่หรือไม่?`)) return;

    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/active`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        // อัปเดต React state โดยสลับสถานะ is_active ของ userId นั้นทันทีโดยไม่ต้องดึงข้อมูลใหม่ทั้งหมด
        setUsers(users.map(u => u.id === userId ? { ...u, is_active: newStatus ? 1 : 0 } : u));
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to update status");
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * handleRoleChange
   * ฟังก์ชันการปรับเปลี่ยนระดับสิทธิ์การใช้งานระบบให้กับผู้ใช้
   * 
   * @param {Number} userId - ไอดีผู้ใช้
   * @param {Number} newRoleId - ไอดีของสิทธิ์ใหม่ที่ได้รับเลือกจาก <select>
   */
  const handleRoleChange = async (userId, newRoleId) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: newRoleId })
      });
      const data = await res.json();
      if (data.success) {
        // ค้นหาวัตถุ Role ที่เลือกมาอัปเดตใน UI React State แบบเรียลไทม์
        const selectedRole = roles.find(r => r.id === newRoleId);
        setUsers(users.map(u => {
          if (u.id === userId) {
            return {
              ...u,
              role: data.data.legacy_role,
              roles: selectedRole ? [{
                id: selectedRole.id,
                name: selectedRole.name,
                level: selectedRole.level
              }] : []
            };
          }
          return u;
        }));
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to assign role");
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * ค้นหาผู้ใช้งานรายบุคคลแบบพิมพ์ค้นหาเรียลไทม์ (Local Filter)
   * กรองจากชื่อผู้ใช้, ชื่อจริง หรือนามสกุล
   */
  const filteredUsers = users.filter(u => {
    const search = searchTerm.toLowerCase();
    return (
      (u.pwa_username || '').toLowerCase().includes(search) ||
      (u.local_username || '').toLowerCase().includes(search) ||
      (u.firstname || '').toLowerCase().includes(search) ||
      (u.lastname || '').toLowerCase().includes(search)
    );
  });

  // แสดงกล่องสถานะขณะกำลังดึงข้อมูล API ครั้งแรก
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50/50">
        <RefreshCw className="w-8 h-8 text-pwa-blue animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 font-display">กำลังโหลดข้อมูลผู้ใช้งาน...</p>
      </div>
    );
  }

  // แสดงข้อความ error เมื่อเกิดข้อผิดพลาดในการโหลด API
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 p-8">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200">
          <h3 className="font-bold text-lg mb-2">เกิดข้อผิดพลาดในการดึงข้อมูล</h3>
          <p>{error}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">ลองใหม่</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* ส่วนปุ่มกดสลับแท็บ (Tab Switching) */}
      <div className="flex border-b border-slate-200">
        {/* แท็บ 1: รายชื่อผู้ใช้ */}
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
            activeTab === 'users' 
              ? 'border-pwa-blue text-pwa-blue bg-pwa-blue-light/10' 
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          รายชื่อผู้ใช้งาน
        </button>
        {/* แท็บ 2: จัดการระดับสิทธิ์ */}
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
            activeTab === 'roles' 
              ? 'border-pwa-blue text-pwa-blue bg-pwa-blue-light/10' 
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Shield className="w-4 h-4" />
          จัดการระดับสิทธิ์
        </button>
        {/* แท็บ 3: ประวัติการใช้งานระบบ */}
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
            activeTab === 'logs' 
              ? 'border-pwa-blue text-pwa-blue bg-pwa-blue-light/10' 
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          ประวัติการใช้งานระบบ
        </button>
      </div>

      {/* ควบคุมการแสดงหน้าย่อยตามแท็บที่ถูกเลือก */}
      {activeTab === 'logs' ? (
        <SystemLogs />
      ) : activeTab === 'roles' ? (
        <RoleManagement />
      ) : (
        <>
          {/* แท็บรายชื่อผู้ใช้งาน: แสดงการ์ดสถิติด้านบน (Dashboard Widgets) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-bold block mb-1">ผู้ใช้งานทั้งหมด</span>
                <span className="text-2xl font-black font-display text-pwa-blue-dark">{users.length} <span className="text-sm">บัญชี</span></span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-pwa-blue-light/50 flex items-center justify-center text-pwa-blue-dark">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-bold block mb-1">ผู้ดูแลระบบ (Admin)</span>
                <span className="text-2xl font-black font-display text-amber-600">{users.filter(u => u.role === 'admin').length} <span className="text-sm">บัญชี</span></span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Shield className="w-6 h-6" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-bold block mb-1">บัญชีที่ถูกระงับ</span>
                <span className="text-2xl font-black font-display text-rose-600">{users.filter(u => !u.is_active).length} <span className="text-sm">บัญชี</span></span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <UserX className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* ส่วนกล่องตารางรายชื่อผู้ใช้ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* เมนูจัดการค้นหา และรีเฟรชข้อมูล */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-800 font-display text-lg">รายชื่อผู้ใช้งานระบบ</h3>
                <button onClick={fetchData} className="p-1.5 text-slate-400 hover:text-pwa-blue hover:bg-pwa-blue-light rounded-lg transition" title="รีเฟรช">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="relative w-full sm:w-72">
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาชื่อ, Username..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue transition shadow-sm"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* ส่วนของตัวตาราง */}
            <div className="overflow-x-auto relative">
              {/* ตัวโหลดเบลอทับตารางชั่วคราวขณะกดบันทึกสถานะหรือบันทึกสิทธิ์ */}
              {isActionLoading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <Activity className="w-8 h-8 text-pwa-blue animate-pulse" />
                </div>
              )}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">ผู้ใช้งาน</th>
                    <th className="px-6 py-4">ประเภทบัญชี</th>
                    <th className="px-6 py-4">สถานะ</th>
                    <th className="px-6 py-4">สิทธิ์การเข้าถึง (Role)</th>
                    <th className="px-6 py-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredUsers.map(user => {
                    const isLocal = user.local_username != null;
                    const usernameDisplay = isLocal ? user.local_username : user.pwa_username;
                    const currentRoleId = user.roles && user.roles.length > 0 ? user.roles[0].id : '';

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition group">
                        {/* คอลัมน์ ข้อมูลผู้ใช้งานเบื้องต้น */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {/* วงกลมรูปโปรไฟล์ย่อตัวแรกของชื่อจริง */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${user.role === 'admin' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-slate-300 to-slate-400'}`}>
                              {(user.firstname?.[0] || usernameDisplay?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{user.firstname} {user.lastname}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">@{usernameDisplay}</p>
                            </div>
                          </div>
                        </td>
                        
                        {/* คอลัมน์ ประเภทการเข้าสู่ระบบ (Local Account หรือบัญชี PWA Intranet) */}
                        <td className="px-6 py-4">
                          {isLocal ? (
                            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-md text-[10px] font-black uppercase tracking-wider">Local Auth</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black uppercase tracking-wider">PWA Intranet</span>
                          )}
                        </td>
                        
                        {/* คอลัมน์ แสดงป้ายสถานะบัญชี */}
                        <td className="px-6 py-4">
                          {user.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                              <CheckCircle className="w-3.5 h-3.5" /> ใช้งานได้
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold text-xs bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                              <UserX className="w-3.5 h-3.5" /> ถูกระงับ
                            </span>
                          )}
                        </td>
                        
                        {/* คอลัมน์ กล่องเปลี่ยนระดับสิทธิ์ */}
                        <td className="px-6 py-4">
                          <select 
                            value={currentRoleId}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={user.id === currentUser?.id} // ห้ามแก้สิทธิ์ตัวเองผ่านหน้านี้
                            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg focus:ring-pwa-blue focus:border-pwa-blue block w-full p-2.5 shadow-sm font-semibold disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
                          >
                            <option value="" disabled>-- เลือกสิทธิ์ --</option>
                            {roles.map(r => (
                              <option key={r.id} value={r.id}>{r.name} (Level {r.level})</option>
                            ))}
                          </select>
                        </td>
                        
                        {/* คอลัมน์ ปุ่มกดเปลี่ยนสถานะเปิด/ระงับใช้งาน */}
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleUserActive(user.id, user.is_active)}
                            disabled={user.id === currentUser?.id} // ห้ามสั่งระงับสิทธิ์ตัวเอง
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                              user.is_active 
                                ? 'bg-white border-rose-200 text-rose-600 hover:bg-rose-50' 
                                : 'bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {user.is_active ? 'ระงับบัญชี' : 'เปิดใช้งาน'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* แสดงเมื่อค้นหาไม่พบข้อมูล */}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                        <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                        ไม่พบข้อมูลผู้ใช้งาน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
