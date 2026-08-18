import { useState, useEffect } from 'react';
import { Users, Shield, UserX, CheckCircle, Search, RefreshCw, Activity, ListOrdered, Upload, Download, AlertCircle, Crown, Building2, Briefcase, UserPlus } from 'lucide-react';
import SystemLogs from './SystemLogs';
import RoleManagement from './RoleManagement';
import LocalUserCreate from './LocalUserCreate';
import { PWA_ZONES, formatPwaBranch, formatPwaZone } from '../pwaDisplay';

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
  const [filterRole, setFilterRole] = useState('all');     // ตัวกรองระดับสิทธิ์ผู้ใช้งาน
  const [isActionLoading, setIsActionLoading] = useState(false); // สถานะกำลังบันทึก/แก้ไขข้อมูลกับ API หลังบ้าน
  const [activeTab, setActiveTab] = useState('users');     // แท็บย่อยที่เลือกเปิดใช้งานอยู่ (users, roles, logs)
  const [branchesFull, setBranchesFull] = useState([]);
  const [filterZone, setFilterZone] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');

  // ดึงข้อมูลรายชื่อผู้ใช้และระดับสิทธิ์ทั้งหมดตั้งแต่เริ่มต้นโหลดหน้านี้
  useEffect(() => {
    fetchData();
  }, []);

  /**
   * fetchData
   * ดึงข้อมูลผู้ใช้งานและระดับสิทธิ์ทั้งหมดแบบขนานกัน (Parallel Request) โดยใช้ Promise.all
   */
  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes, branchesRes] = await Promise.all([
        fetch(`/api/admin/users`, { credentials: 'include' }),
        fetch(`/api/admin/roles`, { credentials: 'include' }),
        fetch(`/api/branches`)
      ]);

      if (!usersRes.ok) {
        const errData = await usersRes.json().catch(()=>({}));
        throw new Error(`Users API Error: ${usersRes.status} ${errData.error || usersRes.statusText}`);
      }
      if (!rolesRes.ok) {
        const errData = await rolesRes.json().catch(()=>({}));
        throw new Error(`Roles API Error: ${rolesRes.status} ${errData.error || rolesRes.statusText}`);
      }
      if (!branchesRes.ok) {
        throw new Error(`Branches API Error: ${branchesRes.statusText}`);
      }

      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();
      const branchesData = await branchesRes.json();

      if (usersData.success) setUsers(usersData.data);
      if (rolesData.success) setRoles(rolesData.data);
      if (branchesData) {
        setBranchesFull(branchesData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
    } catch {
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
              role: data.data.role,
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
    } catch {
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
    const matchesSearch = (
      (u.pwa_username || '').toLowerCase().includes(search) ||
      (u.local_username || '').toLowerCase().includes(search) ||
      (u.firstname || '').toLowerCase().includes(search) ||
      (u.lastname || '').toLowerCase().includes(search) ||
      (u.position || '').toLowerCase().includes(search) ||
      (u.level_name || '').toLowerCase().includes(search) ||
      (u.job_name || '').toLowerCase().includes(search) ||
      (u.div_name || '').toLowerCase().includes(search)
    );

    let matchesRole = true;
    if (filterRole !== 'all') {
      // u.roles คืออาร์เรย์ที่ดึงจากหลังบ้าน
      const userRoleObj = u.roles && u.roles[0];
      const roleLevel = userRoleObj ? userRoleObj.level : null;
      const roleName = userRoleObj ? userRoleObj.name : null;

      if (filterRole === 'admin') {
        matchesRole = roleLevel === 100 || (roleName || '').toLowerCase() === 'admin';
      } else if (filterRole === 'Planning') {
        matchesRole = roleLevel === 50 || (roleName || '').toLowerCase() === 'planning';
      } else if (filterRole === 'user') {
        matchesRole = roleLevel === 0 || (roleName || '').toLowerCase() === 'user';
      }
    }

    let matchesZone = true;
    if (['regadmin', 'RegAdmin'].includes(currentUser?.role) || currentUser?.role?.toLowerCase() === 'regadmin') {
      matchesZone = String(u.area) === String(currentUser?.area);
    } else if (filterZone !== 'all') {
      const userArea = String(u.area) === '99' ? '11' : String(u.area);
      matchesZone = userArea === String(filterZone);
    }

    let matchesBranch = true;
    if (filterBranch !== 'all') {
      matchesBranch = String(u.ba) === String(filterBranch);
    }

    return matchesSearch && matchesRole && matchesZone && matchesBranch;
  });

  const availableBranches = branchesFull.filter(b => {
    if (b.branch_name.startsWith('การประปาส่วนภูมิภาคเขต')) return false;
    if (['regadmin', 'RegAdmin'].includes(currentUser?.role) || currentUser?.role?.toLowerCase() === 'regadmin') return String(b.zone) === String(currentUser?.area);
    if (filterZone !== 'all') return String(b.zone) === String(filterZone);
    return true;
  }).sort((a, b) => String(a.ba).localeCompare(String(b.ba)));

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
        {currentUser?.role === 'admin' && (
        <button
          onClick={() => setActiveTab('local-user')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
            activeTab === 'local-user'
              ? 'border-pwa-blue text-pwa-blue bg-pwa-blue-light/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          เพิ่ม Local User
        </button>
        )}
        {currentUser?.role === 'admin' && (
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
        )}
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
        {/* แท็บ 4: นำเข้าโครงการ (CSV) */}
        {(currentUser?.role === 'admin' || ['regadmin', 'RegAdmin'].includes(currentUser?.role) || currentUser?.role?.toLowerCase() === 'regadmin') && (
        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
            activeTab === 'import' 
              ? 'border-pwa-blue text-pwa-blue bg-pwa-blue-light/10' 
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-4 h-4" />
          นำเข้าโครงการ (CSV)
        </button>
        )}
      </div>

      {/* ควบคุมการแสดงหน้าย่อยตามแท็บที่ถูกเลือก */}
      {activeTab === 'logs' ? (
        <SystemLogs currentUser={currentUser} users={users} roles={roles} branchesFull={branchesFull} />
      ) : activeTab === 'local-user' ? (
        <LocalUserCreate branches={branchesFull} onCreated={fetchData} />
      ) : activeTab === 'roles' ? (
        <RoleManagement currentUser={currentUser} />
      ) : activeTab === 'import' ? (
        <ProjectCsvImport branches={availableBranches.map(b => b.branch_name)} onImportSuccess={fetchData} />
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
              <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
                {/* ช่องค้นหา */}
                <div className="relative w-full sm:w-64">
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ค้นหาชื่อ, Username..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue transition shadow-sm"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                {/* ช่องกรองตามระดับสิทธิ์ */}
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue transition shadow-sm cursor-pointer bg-white"
                  title="กรองตามระดับสิทธิ์"
                >
                  <option value="all">ทุกระดับสิทธิ์</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                  <option value="RegAdmin">ผู้ดูแลระดับเขต (RegAdmin)</option>
                  <option value="Planning">ผู้ดูแลโครงการ (Planning)</option>
                  <option value="user">ผู้ใช้งานทั่วไป (User)</option>
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
                    {PWA_ZONES.map(zone => (
                      <option key={zone} value={zone}>{formatPwaZone(zone)}</option>
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
                  {(['regadmin', 'RegAdmin'].includes(currentUser?.role) || currentUser?.role?.toLowerCase() === 'regadmin' || filterZone !== 'all') && availableBranches.map(b => (
                    <option key={b.ba} value={b.ba}>{formatPwaBranch(b.branch_name)}</option>
                  ))}
                </select>
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
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${
                              user.role?.toLowerCase() === 'admin' ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                              user.role?.toLowerCase() === 'regadmin' ? 'bg-gradient-to-br from-cyan-500 to-blue-600' :
                              user.role?.toLowerCase() === 'planning' ? 'bg-gradient-to-br from-emerald-400 to-teal-600' :
                              'bg-gradient-to-br from-slate-400 to-slate-500'
                            }`}>
                              {user.role?.toLowerCase() === 'admin' ? <Crown className="w-5 h-5 text-white" /> :
                               user.role?.toLowerCase() === 'regadmin' ? <Building2 className="w-5 h-5 text-white" /> :
                               user.role?.toLowerCase() === 'planning' ? <Briefcase className="w-5 h-5 text-white" /> :
                               (user.firstname?.[0] || usernameDisplay?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{user.firstname} {user.lastname}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">@{usernameDisplay}</p>
                              {(user.position || user.level_name) && (
                                <p className="text-xs text-slate-600 font-medium mt-1">
                                  {user.position}{user.level_name ? ` ${user.level_name}` : ''}
                                </p>
                              )}
                              {(user.job_name || user.div_name) && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {user.job_name}{user.job_name && user.div_name ? ' • ' : ''}{user.div_name}
                                </p>
                              )}
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
                            disabled={user.id === currentUser?.id || (currentUser?.role?.toLowerCase() === 'regadmin' && user.role?.toLowerCase() === 'admin')} // ห้ามแก้สิทธิ์ตัวเองหรือ admin
                            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg focus:ring-pwa-blue focus:border-pwa-blue block w-full p-2.5 shadow-sm font-semibold disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
                          >
                            <option value="" disabled>-- เลือกสิทธิ์ --</option>
                            {roles
                              .filter(r => ['regadmin', 'RegAdmin'].includes(currentUser?.role) || currentUser?.role?.toLowerCase() === 'regadmin' ? (['planning', 'user', 'other'].includes(r.name.toLowerCase()) || r.id === currentRoleId) : true)
                              .map(r => (
                              <option key={r.id} value={r.id}>{r.name} (Level {r.level})</option>
                            ))}
                          </select>
                        </td>
                        
                        {/* คอลัมน์ ปุ่มกดเปลี่ยนสถานะเปิด/ระงับใช้งาน */}
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleUserActive(user.id, user.is_active)}
                            disabled={user.id === currentUser?.id || (currentUser?.role?.toLowerCase() === 'regadmin' && user.role?.toLowerCase() === 'admin')} // ห้ามระงับตัวเองหรือ admin
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

// RFC 4180 compliant CSV Parser
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          row[row.length - 1] += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        row[row.length - 1] += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push("");
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && next === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

function ProjectCsvImport({ branches, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchImportHistory();
  }, []);

  async function fetchImportHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/projects/import-history`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setImportHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch import history', err);
    } finally {
      setLoadingHistory(false);
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsedRows = parseCSV(text);
        if (parsedRows.length <= 1) {
          throw new Error('ไม่พบข้อมูลโครงการในไฟล์ CSV หรือไฟล์ว่างเปล่า');
        }

        const rawHeaders = parsedRows[0];
        const headers = rawHeaders.map(h => h.trim().toLowerCase());

        const getIndex = (names) => headers.findIndex(h => names.includes(h));

        const codeIdx = getIndex(['project_code', 'รหัสโครงการ']);
        const contractIdx = getIndex(['contract_no', 'เลขที่สัญญา', 'เลขสัญญา']);
        const branchIdx = getIndex(['branch_name', 'ชื่อสาขา', 'สาขา']);
        const nameIdx = getIndex(['project_name', 'ชื่อโครงการ']);
        const typeIdx = getIndex(['project_type', 'ประเภทโครงการ', 'ประเภท']);
        const startYearIdx = getIndex(['start_year', 'ปีที่เริ่ม', 'ปีที่เริ่มโครงการ']);
        const completedDateIdx = getIndex(['completed_date', 'วันที่แล้วเสร็จ', 'วันที่เสร็จสิ้น']);
        const budgetIdx = getIndex(['budget', 'งบประมาณ', 'วงเงิน']);
        const targetUsersIdx = getIndex(['target_users', 'เป้าหมาย', 'เป้าหมายผู้ใช้น้ำ']);
        const latIdx = getIndex(['latitude', 'ละติจูด', 'พิกัดละติจูด']);
        const lngIdx = getIndex(['longitude', 'ลองจิจูด', 'พิกัดลองจิจูด']);
        const pwaCodeIdx = getIndex(['pwa_code', 'wwcode', 'รหัสสาขา']);

        if (codeIdx === -1 || nameIdx === -1 || branchIdx === -1 || typeIdx === -1 || startYearIdx === -1 || budgetIdx === -1 || targetUsersIdx === -1) {
          throw new Error('โครงสร้างหัวตาราง (Headers) ของไฟล์ CSV ไม่ถูกต้อง กรุณาดาวน์โหลดไฟล์เทมเพลตเพื่อตรวจสอบรูปแบบ');
        }

        const projects = [];
        const rowErrors = [];
        const seenCodes = new Set();

        for (let i = 1; i < parsedRows.length; i++) {
          const row = parsedRows[i];
          if (row.length === 1 && row[0] === '') continue; // Skip empty rows

          const errors = {};
          const rawCode = row[codeIdx]?.trim() || '';
          const rawName = row[nameIdx]?.trim() || '';
          const rawBranch = row[branchIdx]?.trim() || '';
          const rawType = row[typeIdx]?.trim() || '';
          const rawStartYear = row[startYearIdx]?.trim() || '';
          const rawCompletedDate = completedDateIdx !== -1 ? row[completedDateIdx]?.trim() || '' : '';
          const rawBudget = row[budgetIdx]?.trim() || '';
          const rawTargetUsers = row[targetUsersIdx]?.trim() || '';
          const rawLat = latIdx !== -1 ? row[latIdx]?.trim() || '' : '';
          const rawLng = lngIdx !== -1 ? row[lngIdx]?.trim() || '' : '';
          const rawPwaCode = pwaCodeIdx !== -1 ? row[pwaCodeIdx]?.trim() || '' : '';

          if (!rawCode) {
            errors.project_code = 'ไม่มีรหัสโครงการ';
          } else if (seenCodes.has(rawCode)) {
            errors.project_code = 'รหัสโครงการซ้ำกันในไฟล์';
          } else {
            seenCodes.add(rawCode);
          }

          if (!rawName) {
            errors.project_name = 'ไม่มีชื่อโครงการ';
          }

          if (!rawBranch) {
            errors.branch_name = 'ไม่มีชื่อสาขา';
          } else if (branches.length > 0 && !branches.includes(rawBranch)) {
            errors.branch_name = `สาขา '${rawBranch}' ไม่ถูกต้อง`;
          }

          let typeVal = parseInt(rawType);
          if (!rawType) {
            errors.project_type = 'ไม่มีประเภทโครงการ';
          } else if (isNaN(typeVal) || typeVal < 1 || typeVal > 4) {
            errors.project_type = 'ต้องเป็น 1, 2, 3 หรือ 4';
          }

          let yearVal = parseInt(rawStartYear);
          if (!rawStartYear) {
            errors.start_year = 'ไม่มีปีเริ่มโครงการ';
          } else if (isNaN(yearVal) || yearVal < 2500 || yearVal > 2650) {
            errors.start_year = 'ระบุ พ.ศ. ให้ถูกต้อง';
          }

          let budgetVal = parseFloat(rawBudget.replace(/,/g, ''));
          if (!rawBudget) {
            errors.budget = 'ไม่มีงบประมาณ';
          } else if (isNaN(budgetVal) || budgetVal < 0) {
            errors.budget = 'ต้องเป็นตัวเลขเชิงบวก';
          }

          let usersVal = parseInt(rawTargetUsers.replace(/,/g, ''));
          if (!rawTargetUsers) {
            errors.target_users = 'ไม่มีเป้าหมายผู้ใช้น้ำ';
          } else if (isNaN(usersVal) || usersVal < 0) {
            errors.target_users = 'ต้องเป็นจำนวนเต็มเชิงบวก';
          }

          if (rawCompletedDate) {
            const parts = rawCompletedDate.split('/');
            if (parts.length !== 3) {
              errors.completed_date = 'ต้องเป็น วว/ดด/ปปปป';
            } else {
              const d = parseInt(parts[0]);
              const m = parseInt(parts[1]);
              const y = parseInt(parts[2]);
              if (isNaN(d) || isNaN(m) || isNaN(y) || d < 1 || d > 31 || m < 1 || m > 12 || y < 2500) {
                errors.completed_date = 'วันที่ไม่ถูกต้อง';
              }
            }
          }

          let latVal = rawLat ? parseFloat(rawLat) : null;
          if (rawLat && isNaN(latVal)) {
            errors.latitude = 'ต้องเป็นตัวเลข';
          }

          let lngVal = rawLng ? parseFloat(rawLng) : null;
          if (rawLng && isNaN(lngVal)) {
            errors.longitude = 'ต้องเป็นตัวเลข';
          }

          projects.push({
            project_code: rawCode,
            contract_no: contractIdx !== -1
              ? String(row[contractIdx] || '').replace(/\s+/g, '').replace(/^0$/, '')
              : '',
            branch_name: rawBranch,
            project_name: rawName,
            project_type: isNaN(typeVal) ? rawType : typeVal,
            start_year: isNaN(yearVal) ? rawStartYear : yearVal,
            completed_date: rawCompletedDate,
            budget: Number(rawBudget.replace(/,/g, '')),
            target_users: parseInt(rawTargetUsers.replace(/,/g, ''), 10),
            latitude: rawLat,
            longitude: rawLng,
            pwa_code: rawPwaCode,
            errors: Object.keys(errors).length > 0 ? errors : null
          });
          rowErrors.push(errors);
        }

        setParsedData(projects);
        setValidationErrors(rowErrors);
      } catch (err) {
        setError(err.message);
        setFile(null);
        setParsedData([]);
        setValidationErrors([]);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImportSubmit = async () => {
    const hasErrors = validationErrors.some(err => Object.keys(err).length > 0);
    if (hasErrors) {
      if (!window.confirm('ตรวจพบข้อผิดพลาดในข้อมูลบางรายการ คุณยืนยันที่จะนำเข้าเฉพาะโครงการที่ผ่านการตรวจสอบความถูกต้องใช่หรือไม่?')) {
        return;
      }
    }

    const validProjects = parsedData.filter((_, idx) => Object.keys(validationErrors[idx]).length === 0);
    if (validProjects.length === 0) {
      alert('ไม่พบข้อมูลโครงการที่ถูกต้องสมบูรณ์สำหรับการนำเข้า');
      return;
    }

    setImporting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: validProjects, file_name: file.name }),
        credentials: 'include'
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data);
        onImportSuccess();
        fetchImportHistory(); // โหลดประวัติใหม่
        setFile(null);
        setParsedData([]);
        setValidationErrors([]);
      } else {
        const conflictDetails = Array.isArray(data.conflicts)
          ? data.conflicts.map((conflict, index) => `${index + 1}. ${conflict.message}`).join('\n')
          : '';
        const message = data.message || data.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล';
        throw new Error(conflictDetails ? `${message}\n${conflictDetails}` : message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvHeaders = [
      'project_code',
      'contract_no',
      'branch_name',
      'project_name',
      'project_type',
      'start_year',
      'completed_date',
      'budget',
      'target_users',
      'latitude',
      'longitude'
    ];
    const csvSampleRow = [
      '1Z.68.0001.2.1.5.00.1',
      'เขต 6/123/2568',
      'ขอนแก่น',
      'โครงการขยายเขตวางท่อจำหน่ายน้ำ บ้านทดสอบ',
      '1',
      '2568',
      '15/03/2568',
      '4500000',
      '150',
      '16.4322',
      '102.8236'
    ];
    
    const csvContent = '\uFEFF' + csvHeaders.join(',') + '\n' + csvSampleRow.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'pwa6_import_template.csv');
    link.click();
  };

  const totalCount = parsedData.length;
  const invalidCount = validationErrors.filter(err => Object.keys(err).length > 0).length;
  const validCount = totalCount - invalidCount;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 font-display text-lg">นำเข้าข้อมูลโครงการขยายเขตจำหน่ายน้ำด้วยไฟล์ CSV</h3>
            <p className="text-xs text-slate-500 font-light mt-1">อัปโหลดไฟล์ข้อมูลโครงการหลายรายการพร้อมกันเพื่อประเมินผลสัมฤทธิ์อย่างรวดเร็ว</p>
            <p className="text-[11px] font-semibold text-rose-500 mt-2 flex items-center gap-1.5 bg-rose-50 p-2 rounded-lg border border-rose-100 w-fit">
              <AlertCircle className="w-3.5 h-3.5" /> สามารถบันทึกข้อมูลโครงการเฉพาะสาขาที่ตนดูแลเท่านั้น
            </p>
          </div>
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition duration-150 active:scale-95 cursor-pointer border border-slate-200"
          >
            <Download className="w-4 h-4" />
            ดาวน์โหลดไฟล์เทมเพลต CSV
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold mb-6 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}

        {result && (
          <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl mb-6 space-y-2 animate-fadeIn">
            <h4 className="font-bold text-sm flex items-center gap-1.5 text-emerald-900">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {result.message}
            </h4>
            {result.skippedCount > 0 && (
              <div className="text-xs text-emerald-800/95 font-medium mt-1">
                <span className="font-bold text-amber-700">⚠️ ตรวจพบโครงการที่ข้ามเนื่องจากรหัสซ้ำ ({result.skippedCount} โครงการ):</span>
                <ul className="list-disc list-inside mt-1 font-mono text-[10px] pl-2 max-h-24 overflow-y-auto">
                  {result.skipped.map((s, idx) => (
                    <li key={idx}>{s.project_code} - {s.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100/40 transition duration-150 relative">
          <input 
            type="file" 
            accept=".csv"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="เลือกไฟล์ CSV สำหรับนำเข้า"
          />
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">{file ? `เลือกไฟล์: ${file.name}` : 'ลากไฟล์ CSV มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}</p>
          <p className="text-xs text-slate-400 mt-1">รองรับเฉพาะรูปแบบไฟล์แบบเครื่องหมายจุลภาคคั่น (Comma-Separated Values, .csv) เข้ารหัส UTF-8</p>
        </div>
      </div>

      {parsedData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col animate-fadeIn">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-slate-800 font-display">ตัวอย่างข้อมูลโครงการและตรวจสอบความถูกต้อง</h3>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-650 text-xs font-bold">ทั้งหมด: {totalCount} รายการ</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">ผ่าน: {validCount} รายการ</span>
                {invalidCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-xs font-bold">ไม่ผ่าน: {invalidCount} รายการ</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => { setFile(null); setParsedData([]); setValidationErrors([]); }}
                className="px-4 py-2 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition duration-150 cursor-pointer active:scale-95"
              >
                ยกเลิก
              </button>
              <button 
                disabled={importing || validCount === 0}
                onClick={handleImportSubmit}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition duration-150 active:scale-95 shadow-md shadow-blue-500/10 cursor-pointer"
              >
                {importing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                {importing ? 'กำลังนำเข้าข้อมูล...' : `ยืนยันนำเข้าข้อมูล (${validCount} โครงการ)`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10">
                  <th className="px-4 py-3 bg-slate-50">รหัสโครงการ</th>
                  <th className="px-4 py-3 bg-slate-50">ชื่อโครงการ</th>
                  <th className="px-4 py-3 bg-slate-50">สาขา</th>
                  <th className="px-4 py-3 bg-slate-50 text-center">ประเภท</th>
                  <th className="px-4 py-3 bg-slate-50 text-center">ปีเริ่มสร้าง (พ.ศ.)</th>
                  <th className="px-4 py-3 bg-slate-50 text-right">วงเงินงบประมาณ</th>
                  <th className="px-4 py-3 bg-slate-50 text-right">เป้าหมาย (ราย)</th>
                  <th className="px-4 py-3 bg-slate-50">เลขที่สัญญา</th>
                  <th className="px-4 py-3 bg-slate-50">พิกัด (Lat, Lng)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {parsedData.map((p, idx) => {
                  const errors = validationErrors[idx] || {};
                  const isInvalid = Object.keys(errors).length > 0;

                  return (
                    <tr key={idx} className={`${isInvalid ? 'bg-rose-50/35 hover:bg-rose-50/50' : 'hover:bg-slate-50/50'} transition`}>
                      <td className="px-4 py-3 font-mono font-bold">
                        <span className={errors.project_code ? 'text-rose-600 underline decoration-dotted font-bold' : ''} title={errors.project_code}>
                          {p.project_code || <span className="text-rose-500 italic">ไม่มีข้อมูล</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={p.project_name}>
                        <span className={errors.project_name ? 'text-rose-600 underline decoration-dotted font-bold' : ''} title={errors.project_name}>
                          {p.project_name || <span className="text-rose-500 italic">ไม่มีข้อมูล</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <span className={errors.branch_name ? 'text-rose-600 underline decoration-dotted font-bold' : ''} title={errors.branch_name}>
                          {p.branch_name || <span className="text-rose-500 italic">ไม่มีข้อมูล</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={errors.project_type ? 'text-rose-600 underline decoration-dotted font-bold' : ''} title={errors.project_type}>
                          {p.project_type || <span className="text-rose-500 italic">ไม่มีข้อมูล</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={errors.start_year ? 'text-rose-600 underline decoration-dotted font-bold' : ''} title={errors.start_year}>
                          {p.start_year || <span className="text-rose-500 italic">ไม่มีข้อมูล</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span className={errors.budget ? 'text-rose-600 underline decoration-dotted font-bold' : ''} title={errors.budget}>
                          {typeof p.budget === 'number' ? p.budget.toLocaleString() : p.budget || <span className="text-rose-500 italic">ไม่มีข้อมูล</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span className={errors.target_users ? 'text-rose-600 underline decoration-dotted font-bold' : ''} title={errors.target_users}>
                          {typeof p.target_users === 'number' ? p.target_users.toLocaleString() : p.target_users || <span className="text-rose-500 italic">ไม่มีข้อมูล</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500" title={p.completed_date ? `วันที่แล้วเสร็จ: ${p.completed_date}` : ''}>
                        {p.contract_no || '-'}
                        {p.completed_date && <span className={errors.completed_date ? 'text-rose-600 font-bold block' : 'block text-[9px] text-slate-400'}>{errors.completed_date ? `วันเสร็จ: ${errors.completed_date}` : `เสร็จ: ${p.completed_date}`}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                        {p.latitude && p.longitude ? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}` : '-'}
                        {errors.latitude && <span className="text-rose-600 block">Lat: {errors.latitude}</span>}
                        {errors.longitude && <span className="text-rose-600 block">Lng: {errors.longitude}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ตารางประวัติการนำเข้า */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mt-6 animate-fadeIn">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 font-display">ประวัติการนำเข้าข้อมูล (นำเข้าล่าสุด)</h3>
            <button onClick={fetchImportHistory} disabled={loadingHistory} className="text-slate-500 hover:text-blue-600 transition p-1 cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            {loadingHistory ? (
              <div className="p-8 text-center text-slate-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> กำลังโหลดประวัติ...</div>
            ) : importHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic">ยังไม่มีประวัติการนำเข้าข้อมูล</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                    <th className="px-4 py-3">วัน/เวลา</th>
                    <th className="px-4 py-3">ชื่อไฟล์</th>
                    <th className="px-4 py-3 text-center">ระดับสิทธิ์</th>
                    <th className="px-4 py-3 text-center">เขต กปภ.</th>
                    <th className="px-4 py-3 text-right">จำนวนแถวทั้งหมด</th>
                    <th className="px-4 py-3 text-right text-emerald-600">นำเข้าสำเร็จ</th>
                    <th className="px-4 py-3 text-right text-rose-500">ข้าม (ซ้ำ/ไม่ถูกต้อง)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString('th-TH')}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate" title={row.file_name}>
                        {row.file_name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.user_role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {row.user_role === 'admin' ? 'Admin (ส่วนกลาง)' : 'RegAdmin'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700">
                        {row.user_zone ? `เขต ${row.user_zone}` : 'ทุกเขต'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{row.total_records.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{row.imported_records.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-500">{row.skipped_records.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
  );
}
