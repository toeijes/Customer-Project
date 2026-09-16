import { FileText } from 'lucide-react';

export default function ZoneNoProjectsEmptyState({ zone }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-16 shadow-sm text-center flex flex-col items-center justify-center my-8 animate-fadeIn">
      <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-[#00529b] mb-4 border border-blue-100 shadow-inner">
        <FileText className="w-10 h-10 text-[#00529b]" />
      </div>
      <h3 className="text-xl font-extrabold text-slate-800 font-display mb-2">
        ไม่พบข้อมูลโครงการใน การประปาส่วนภูมิภาคเขต {zone}
      </h3>
      <p className="text-sm text-slate-500 font-medium max-w-md leading-relaxed">
        ขณะนี้ยังไม่มีรายการข้อมูลโครงการวางท่อขยายเขตจำหน่ายน้ำประปาในสังกัด กปภ.เขต {zone} ในระบบข้อมูล
      </p>
    </div>
  );
}
