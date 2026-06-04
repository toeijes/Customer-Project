import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', level: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return alert('กรุณาระบุชื่อสิทธิ์');
    
    setIsSubmitting(true);
    try {
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
        fetchRoles();
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

  const handleDelete = async (id, name) => {
    if (name === 'admin' || name === 'user') {
      alert("ไม่อนุญาตให้ลบสิทธิ์พื้นฐานของระบบ (admin, user)");
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

  const handleToggleActive = async (id) => {
    try {
      const res = await fetch(`/api/admin/roles/${id}/toggle-active`, {
        method: 'PUT',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setRoles(roles.map(r => r.id === id ? { ...r, is_active: !r.is_active } : r));
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to toggle status");
    }
  };

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
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Header Area */}
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

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map(role => (
          <div key={role.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col group hover:border-pwa-blue/30 transition">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${role.level >= 100 ? 'bg-amber-500' : 'bg-pwa-blue'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg leading-none">{role.name}</h4>
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-1 block">Level {role.level}</span>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenModal(role)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="แก้ไข">
                  <Edit2 className="w-4 h-4" />
                </button>
                {role.name !== 'admin' && role.name !== 'user' && (
                  <button onClick={() => handleDelete(role.id, role.name)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="ลบ">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <p className="text-sm text-slate-600 flex-1 mb-4 line-clamp-2">
              {role.description || <span className="text-slate-400 italic">ไม่มีคำอธิบาย</span>}
            </p>
            
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slideUp">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 font-display text-lg">
                {editingRole ? 'แก้ไขระดับสิทธิ์' : 'สร้างระดับสิทธิ์ใหม่'}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-rose-500 transition">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อสิทธิ์ (Role Name) <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-pwa-blue/20 focus:border-pwa-blue outline-none transition"
                  placeholder="เช่น manager, viewer"
                  disabled={editingRole && (editingRole.name === 'admin' || editingRole.name === 'user')}
                  required
                />
                {editingRole && (editingRole.name === 'admin' || editingRole.name === 'user') && (
                  <p className="text-xs text-amber-600 mt-1 font-semibold">ไม่สามารถเปลี่ยนชื่อสิทธิ์พื้นฐานของระบบได้</p>
                )}
              </div>
              
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
