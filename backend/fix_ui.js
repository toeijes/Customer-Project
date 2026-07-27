const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/components/EarlyCustomersReport.jsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /\{\/\* Summary Cards \*\/\}\s*<\/div>\s*<div.*?<\/div>\s*<\/div>\s*<\/div>\s*\{\/\* Data Table \*\/\}\s*<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">/s;

const replacement = `{/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
         <div className="bg-gradient-to-br from-rose-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(244,63,94,0.15)] border border-rose-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(244,63,94,0.3)] hover:-translate-y-0.5 transition-all duration-300">
             <div className="relative z-10 flex items-center justify-between mb-1">
                 <div className="text-xs font-bold text-rose-800/70">โครงการที่พบปัญหา</div>
                 <div className="p-1.5 bg-rose-100/80 rounded-lg text-rose-600 group-hover:scale-110 transition-transform duration-300">
                     <AlertTriangle size={16} strokeWidth={2.5} />
                 </div>
             </div>
             <div className="relative z-10">
                 <div className="text-2xl font-black text-rose-600 tracking-tight">{processedData.totalProjects.toLocaleString()}</div>
             </div>
             <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-rose-400/5 to-rose-500/10 rounded-full blur-xl group-hover:bg-rose-400/20 transition-colors duration-500"></div>
         </div>
         <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(59,130,246,0.15)] border border-blue-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 transition-all duration-300">
             <div className="relative z-10 flex items-center justify-between mb-1">
                 <div className="text-xs font-bold text-blue-800/70">สาขาที่ได้รับผลกระทบ</div>
                 <div className="p-1.5 bg-blue-100/80 rounded-lg text-blue-600 group-hover:scale-110 transition-transform duration-300">
                     <Briefcase size={16} strokeWidth={2.5} />
                 </div>
             </div>
             <div className="relative z-10">
                 <div className="text-2xl font-black text-blue-700 tracking-tight">{processedData.totalBranches.toLocaleString()}</div>
             </div>
             <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-blue-400/5 to-blue-500/10 rounded-full blur-xl group-hover:bg-blue-400/20 transition-colors duration-500"></div>
         </div>
         <div className="bg-gradient-to-br from-orange-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(249,115,22,0.15)] border border-orange-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(249,115,22,0.3)] hover:-translate-y-0.5 transition-all duration-300">
             <div className="relative z-10 flex items-center justify-between mb-1">
                 <div className="text-xs font-bold text-orange-800/70">จำนวนลูกค้าที่ผิดปกติรวม</div>
                 <div className="p-1.5 bg-orange-100/80 rounded-lg text-orange-600 group-hover:scale-110 transition-transform duration-300">
                     <Users size={16} strokeWidth={2.5} />
                 </div>
             </div>
             <div className="relative z-10">
                 <div className="text-2xl font-black text-orange-600 tracking-tight">{processedData.totalAbnormal.toLocaleString()}</div>
             </div>
             <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-orange-400/5 to-orange-500/10 rounded-full blur-xl group-hover:bg-orange-400/20 transition-colors duration-500"></div>
         </div>
         <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-2xl shadow-[0_2px_10px_-3px_rgba(168,85,247,0.15)] border border-purple-100 relative overflow-hidden group hover:shadow-[0_8px_20px_-6px_rgba(168,85,247,0.3)] hover:-translate-y-0.5 transition-all duration-300">
             <div className="relative z-10 flex items-center justify-between mb-1">
                 <div className="text-xs font-bold text-purple-800/70">ยอดผิดปกติสูงสุดต่อโครงการ</div>
                 <div className="p-1.5 bg-purple-100/80 rounded-lg text-purple-600 group-hover:scale-110 transition-transform duration-300">
                     <AlertTriangle size={16} strokeWidth={2.5} />
                 </div>
             </div>
             <div className="relative z-10">
                 <div className="text-2xl font-black text-purple-600 tracking-tight">{processedData.maxAbnormal.toLocaleString()}</div>
             </div>
             <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-purple-400/5 to-purple-500/10 rounded-full blur-xl group-hover:bg-purple-400/20 transition-colors duration-500"></div>
         </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">`;

code = code.replace(regex, replacement);

fs.writeFileSync(path, code);
console.log('Fixed summary cards and table container classes.');
