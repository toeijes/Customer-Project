import React, { useState } from 'react';
import { Layers, Lock, User, AlertTriangle, Eye, EyeOff } from 'lucide-react';

/**
 * Component: Login
 * หน้าจอสำหรับเข้าสู่ระบบของระบบติดตามและประเมินโครงการวางท่อขยายเขตจำหน่ายน้ำประปา กปภ.ข.6
 * รองรับทั้งการเข้าสู่ระบบผ่านบัญชี PWA Intranet API และบัญชี Local (สำหรับผู้ดูแลระบบ)
 * 
 * @param {Function} onLoginSuccess - callback function ที่จะถูกเรียกเมื่อเข้าสู่ระบบสำเร็จ โดยจะส่งข้อมูลผู้ใช้ (User Object) กลับไปยัง component หลัก (App.jsx)
 */
const Login = ({ onLoginSuccess }) => {
  // --- React States ---
  const [username, setUsername] = useState(''); // เก็บค่า Username (รหัสพนักงาน) ที่ผู้ใช้กรอก
  const [password, setPassword] = useState(''); // เก็บค่า Password ที่ผู้ใช้กรอก
  const [showPassword, setShowPassword] = useState(false); // สถานะการแสดง/ซ่อนรหัสผ่าน
  const [loading, setLoading] = useState(false); // ควบคุมสถานะการดาวน์โหลด/การตรวจสอบขณะเรียก API
  const [error, setError] = useState('');       // เก็บข้อความแสดงความผิดพลาดเมื่อล็อกอินไม่สำเร็จ

  /**
   * handleLogin
   * ฟังก์ชันจัดการเมื่อส่งฟอร์มเข้าสู่ระบบ (Submit Form)
   */
  const handleLogin = async (e) => {
    e.preventDefault(); // ป้องกันการ reload หน้าจอของเบราว์เซอร์
    setError('');       // รีเซ็ตข้อความข้อผิดพลาดเก่า
    setLoading(true);   // แสดงสถานะกำลังโหลด (และปิดการกดปุ่มชั่วคราว)

    try {
      // ดึงค่า URL ของ API หลังบ้านจาก Environment Variables (ถ้าไม่มีจะใช้ค่าเริ่มต้นคือ '/api')
      const API_BASE = import.meta.env.VITE_API_BASE || '/api';
      
      // เรียกใช้ API หลังบ้านเพื่อล็อกอิน
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include' // สำคัญ: ส่ง Cookie / Session ไปด้วยเพื่อให้คงสถานะการเข้าสู่ระบบ
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // หากเข้าสู่ระบบสำเร็จ ให้ส่งข้อมูล User กลับไปเซ็ตค่าใน App.jsx
        onLoginSuccess(data.data.user);
      } else {
        // หากหลังบ้านปฏิเสธการล็อกอิน หรือข้อมูลไม่ถูกต้อง
        setError(data.error || 'การเข้าสู่ระบบล้มเหลว');
      }
    } catch (err) {
      // กรณีไม่สามารถติดต่อเซิร์ฟเวอร์หรือเกิดปัญหาเครือข่าย
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false); // ปิดสถานะการโหลด
    }
  };

  return (
    // จัดตำแหน่งแบบกึ่งกลางหน้าจอ (Flexbox) และใช้สีพื้นหลังเข้มธีมเดียวกับระบบหลัก
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" style={{ fontFamily: "'Sarabun', sans-serif" }}>
      <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden w-full max-w-md">
        
        {/* ส่วนหัวของกล่องล็อกอิน (Header) */}
        <div className="p-8 text-center bg-gradient-to-br from-slate-800 to-slate-900 border-b border-slate-700">
          <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Layers size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 leading-snug">ระบบติดตามและประเมินโครงการวางท่อขยายเขตจำหน่ายน้ำประปา กปภ.ข.6</h2>
          <p className="text-slate-400 text-sm">เข้าสู่ระบบด้วยบัญชีอินทราเน็ต กปภ. หรือบัญชีผู้ดูแลระบบ</p>
        </div>

        {/* ส่วนเนื้อหาและฟอร์ม (Form Section) */}
        <div className="p-8">
          {/* แสดงกล่องแจ้งเตือนความผิดพลาดหาก error มีค่า */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* ช่องกรอกชื่อผู้ใช้งาน */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">ชื่อผู้ใช้งาน</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all sm:text-sm"
                  placeholder="รหัสพนักงาน"
                />
              </div>
            </div>

            {/* ช่องกรอกรหัสผ่าน */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all sm:text-sm"
                  placeholder="รหัสผ่านอินทราเน็ต"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none"
                  title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* ปุ่มกดยอมรับฟอร์ม (Submit) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
