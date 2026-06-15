import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';

// Base URL สำหรับเรียกใช้ API หลังบ้าน
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/**
 * Component: RoleManagement
 * หน้าจอจัดการระดับสิทธิ์การเข้าถึง (Roles) ของระบบ
 * อนุญาตให้แอดมินสร้างระดับสิทธิ์ใหม่ แก้ไข หรือลบสิทธิ์ได้
 * พร้อมทั้งระบบป้องกันความปลอดภัย ห้ามลบหรือแก้ไขชื่อสิทธิ์ระบบขั้นพื้นฐาน ได้แก่ 'admin' และ 'user'
 */
export default function RoleManagement() {
  // --- React States ---
  const [roles, setRoles] = useState([]);               // เก็บรายการสิทธิ์ทั้งหมดที่ดึงมาจาก API
  const [loading, setLoading] = useState(true);           // แสดงสถานะดาวน์โหลดข้อมูลสิทธิ์
  const [error, setError] = useState(null);               // เก็บข้อความแสดงข้อผิดพลาดเมื่อ API ล้มเหลว
  
  // --- Modal States (ฟอร์มสร้าง/แก้ไขสิทธิ์) ---
  const [isModalOpen, setIsModalOpen] = useState(false);       // ควบคุมการเปิด/ปิดหน้าต่างแบบ Modal ป๊อปอัพ
  const [editingRole, setEditingRole] = useState(null);       // เก็บวัตถุ Role ที่กำลังจะแก้ไข (ถ้าเป็น null หมายถึงกำลังสร้างสิทธิ์ใหม่)
  const [formData, setFormData] = useState({ name: '', description: '', level: 0 }); // ข้อมูลที่ผูกกับฟิลด์ต่าง ๆ ในฟอร์ม
  const [isSubmitting, setIsSubmitting] = useState(false);     // ป้องกันการกดบันทึกซ้ำซ้อนขณะเรียก API บันทึกข้อมูล

  // ดึงข้อมูลสิทธิ์ทั้งหมดเมื่อเปิดหน้านี้ขึ้นมาครั้งแรก
  useEffect(() => {
    fetchRoles();
  }, []);

  /**
   * fetchRoles
   * ดึงระดับสิทธิ์ทั้งหมดจาก API `/api/admin/roles`
   */
  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch roles');
      const data = await res.json();
      if (data.success) {
        setRoles(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * handleOpenModal
   * เปิด Modal พร้อมตั้งค่าฟอร์ม:
   * - หากส่งวัตถุ `role` เข้ามา -> โหมดแก้ไข (ป้อนข้อมูลสิทธิ์เก่าลงฟิลด์เพื่อรอการแก้ไข)
   * - หากไม่ส่งวัตถุเข้ามา -> โหมดสร้างใหม่ (ล้างข้อมูลในฟอร์มทั้งหมดเป็นค่าว่าง)
   * 
   * @param {Object|null} role - ข้อมูลสิทธิ์เดิมที่จะแก้ไข
   */
  const handleOpenModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({ name: role.name, description: role.description || '', level: role.level });
    } else {
      setEditingRole(null);
      setFormData({ name: '', description: '', level: 0 });
    }
    setIsModalOpen(true);
  };

  /**
   * handleCloseModal
   * ปิด Modal และเคลียร์ state การแก้ไข
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
  };

  /**
   * handleSubmit
   * ฟังก์ชันส่งฟอร์มเพื่อ บันทึก (สร้างใหม่ หรือ ปรับปรุง) สิทธิ์การเข้าถึงไปยัง API หลังบ้าน
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return alert('กรุณาระบุชื่อสิทธิ์');
    
    setIsSubmitting(true);
    try {
      // ตรวจสอบ endpoint และ method ตามโหมด (สร้างใหม่ = POST / แก้ไขสิทธิ์ = PUT ที่ระบุ ID ของสิทธิ์)
      const url = editingRole ? `/api/admin/roles/${editingRole.id}` : `/api/admin/roles`;
      const method = editingRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (data.success) {
        fetchRoles(); // โหลดรายการสิทธิ์ใหม่ทั้งหมดหลังจากการอัปเดต
        handleCloseModal();
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to save role");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleDelete
   * ลบระดับสิทธิ์ที่ไม่ใช้งานแล้วออกจากระบบ
   * ป้องกันความปลอดภัยขั้นสูงสุด: ห้ามลบสิทธิ์พื้นฐาน 'admin' หรือ 'user' โดยเด็ดขาด
   */
  const handleDelete = async (id, name) => {
    // บล็อกการลบสิทธิ์สำคัญต่อระบบ
    if (name === 'admin' || name === 'user' || name === 'Other') {
      alert("ไม่อนุญาตให้ลบสิทธิ์พื้นฐานของระบบ (admin, user, Other)");
      return;
    }
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิทธิ์ "${name}"?\nผู้ใช้งานที่มีสิทธิ์นี้อาจได้รับผลกระทบ`)) return;

    try {
      const res = await fetch(`/api/admin/roles/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        fetchRoles();
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to delete role");
    }
  };

  /**
   * handleToggleActive
   * ฟังก์ชันการสลับสถานะเปิดใช้ / ปิดใช้งานชั่วคราว (Toggle IsActive) ของระดับสิทธิ์
   */
  const handleToggleActive = async (id) => {
    try {
      const res = await fetch(`/api/admin/roles/${id}/toggle-active`, {
        method: 'PUT',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        // ทำการสลับตัวเลือก is_active ใน React State ทันทีโดยไม่ต้อง query API ซ้ำอีกครั้ง
        setRoles(roles.map(r => r.id === id ? { ...r, is_active: !r.is_active } : r));
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to toggle status");
    }
  };

  // แสดงตัวดาวน์โหลดเมื่อโหลดสิทธิ์ครั้งแรก
  if (loading && roles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-pwa-blue animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500">กำลังโหลดข้อมูลสิทธิ์...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ส่วนแสดงข้อผิดพลาดถ้ามี */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* เมนูด้านบน แสดงหัวข้อ และปุ่มสร้างระดับสิทธิ์ใหม่ */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 font-display text-lg">จัดการระดับสิทธิ์การเข้าถึง (Roles)</h3>
          <p className="text-xs text-slate-500 mt-1">สร้างและปรับแต่งระดับสิทธิ์เพื่อนำไปกำหนดให้กับผู้ใช้งาน</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-pwa-blue hover:bg-pwa-blue-dark text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> สร้างระดับสิทธิ์ใหม่
        </button>
      </div>

      {/* ส่วนแสดงการ์ดระดับสิทธิ์ทั้งหมด (Roles Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map(role => (
          <div key={role.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col group hover:border-pwa-blue/30 transition">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* ไอคอนแสดงสีแยกตามระดับความสูงของสิทธิ์ (Level >= 100 แสดงสีส้ม/แอดมิน, ต่ำกว่าแสดงสีน้ำเงิน/ผู้ใช้ทั่วไป) */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${role.level >= 100 ? 'bg-amber-500' : 'bg-pwa-blue'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg leading-none">{role.name}</h4>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-1 block">Level {role.level}</span>
                </div>
              </div>
              
              {/* ปุ่มจัดการ: แก้ไข และลบ (ปุ่มจะซ่อนไว้และเปิดขึ้นเมื่อ hover การ์ด) */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenModal(role)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="แก้ไข">
                  <Edit2 className="w-4 h-4" />
                </button>
                {/* ห้ามลบสิทธิ์ admin, user หรือ Other */}
                {role.name !== 'admin' && role.name !== 'user' && role.name !== 'Other' && (
                  <button onClick={() => handleDelete(role.id, role.name)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="ลบ">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* คำอธิบายสิทธิ์การใช้งาน */}
            <p className="text-sm text-slate-600 flex-1 mb-4 line-clamp-2">
              {role.description || <span className="text-slate-400 italic">ไม่มีคำอธิบาย</span>}
            </p>
            
            {/* สถานะการเปิดใช้งานการ์ด และลิงก์สลับสถานะ */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                role.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                {role.is_active ? <><CheckCircle className="w-3.5 h-3.5" /> ใช้งานได้</> : <><XCircle className="w-3.5 h-3.5" /> ปิดใช้งาน</>}
              </span>
              
              <button 
                onClick={() => handleToggleActive(role.id)}
                className="text-xs text-slate-500 hover:text-pwa-blue underline font-semibold"
              >
                {role.is_active ? 'ระงับสิทธิ์นี้' : 'เปิดใช้งาน'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ส่วนของกล่องโต้ตอบ Modal แบบฟอร์มกรอกบันทึกข้อมูล */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slideUp">
            
            {/* หัวข้อโมดอลย่อย */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 font-display text-lg">
                {editingRole ? 'แก้ไขระดับสิทธิ์' : 'สร้างระดับสิทธิ์ใหม่'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-rose-500 transition">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            {/* ฟอร์มกรอกข้อมูล */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* ฟิลด์ชื่อสิทธิ์ */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อสิทธิ์ (Role Name) <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue outline-none transition"
                  placeholder="เช่น manager, viewer"
                  disabled={editingRole && (editingRole.name === 'admin' || editingRole.name === 'user')} // ล็อกไม่ให้ตั้งชื่อแก้ชื่อ admin, user
                  required
                />
                {editingRole && (editingRole.name === 'admin' || editingRole.name === 'user') && (
                  <p className="text-xs text-amber-600 mt-1 font-semibold">ไม่สามารถเปลี่ยนชื่อสิทธิ์พื้นฐานของระบบได้</p>
                )}
              </div>
              
              {/* ฟิลด์รายละเอียด */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">คำอธิบาย</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue outline-none transition"
                  rows="3"
                  placeholder="อธิบายหน้าที่ของสิทธิ์นี้..."
                />
              </div>

              {/* ฟิลด์ค่าระดับความสูง (Level) เพื่อใช้พิจารณาความปลอดภัยหลังบ้าน */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ระดับ (Level)</label>
                <input 
                  type="number" 
                  value={formData.level}
                  onChange={e => setFormData({...formData, level: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue outline-none transition"
                  min="0"
                  max="100"
                />
                <p className="text-[10px] text-slate-500 mt-1">ตัวเลข 0-100 (ยิ่งมากยิ่งมีสิทธิ์สูง, 100 = แอดมินสูงสุด)</p>
              </div>

              {/* ปุ่มยอมรับ/ยกเลิก */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-pwa-blue hover:bg-pwa-blue-dark text-white font-bold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
