import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Layers, Search, Download, RefreshCw, CheckCircle2, AlertTriangle, 
  Calendar, DollarSign, Users, Award, ChevronLeft, ChevronRight,
  Database, Briefcase, MapPin, Grid, BarChart3, TrendingUp
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PROJECT_TYPES = {
  1: 'โครงการขยายเขตจำหน่ายน้ำ (งบลงทุน)',
  2: 'โครงการขยายเขตจำหน่ายน้ำ (งบอุดหนุน)',
  3: 'โครงการขยายเขตจำหน่ายน้ำ (งบกระตุ้นเศรษฐกิจ)',
  4: 'โครงการวางท่อเข้าซอย'
};

const PROJECT_TYPES_SHORT = {
  1: 'งบลงทุน',
  2: 'งบอุดหนุน',
  3: 'งบกระตุ้นเศรษฐกิจ',
  4: 'วางท่อเข้าซอย'
};

const MONTHS_TH = [
  { num: 10, name: 'ตุลาคม' },
  { num: 11, name: 'พฤศจิกายน' },
  { num: 12, name: 'ธันวาคม' },
  { num: 1, name: 'มกราคม' },
  { num: 2, name: 'กุมภาพันธ์' },
  { num: 3, name: 'มีนาคม' },
  { num: 4, name: 'เมษายน' },
  { num: 5, name: 'พฤษภาคม' },
  { num: 6, name: 'มิถุนายน' },
  { num: 7, name: 'กรกฎาคม' },
  { num: 8, name: 'สิงหาคม' },
  { num: 9, name: 'กันยายน' }
];

const FISCAL_YEARS = [2564, 2565, 2566, 2567, 2568, 2569];

function App() {
  const [currentTab, setCurrentTab] = useState('projects'); // 'projects', 'monthly', 'breakeven'
  
  // Data State from Backend
  const [branches, setBranches] = useState([]);
  const [projects, setProjects] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Global Filters
  const [filterYear, setFilterYear] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting & Pagination for Datatable
  const [sortField, setSortField] = useState('project_code');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Screen 2 Monthly Selection for Drill-down
  const [selectedBranchDrill, setSelectedBranchDrill] = useState(null);
  const [selectedMonthDrill, setSelectedMonthDrill] = useState(null);
  const [selectedYearDrill, setSelectedYearDrill] = useState(null);

  // Screen 3 Break-even Deep-Dive Selection
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Map Feature States
  const [selectedProjectMap, setSelectedProjectMap] = useState(null);
  const [projectCustomers, setProjectCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // API base URL
  const API_BASE = 'http://localhost:5000/api';

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch branches, projects and monthly data in parallel
        const [resBranches, resProjects, resMonthly] = await Promise.all([
          fetch(`${API_BASE}/branches`),
          fetch(`${API_BASE}/projects`),
          fetch(`${API_BASE}/monthly-data`)
        ]);

        if (!resBranches.ok || !resProjects.ok || !resMonthly.ok) {
          throw new Error('ระบบไม่สามารถเรียกข้อมูลจากเซิร์ฟเวอร์ MySQL ได้ กรุณาตรวจสอบสถานะ backend');
        }

        const dataBranches = await resBranches.json();
        const dataProjects = await resProjects.json();
        const dataMonthly = await resMonthly.json();

        setBranches(dataBranches);
        setProjects(dataProjects);
        setMonthlyData(dataMonthly);

        // Set default selected project for deep dive analyzer if projects are available
        if (dataProjects.length > 0) {
          setSelectedProjectId(dataProjects[0].id);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Fetch customer coordinates when selectedProjectMap changes
  useEffect(() => {
    if (!selectedProjectMap) {
      setProjectCustomers([]);
      return;
    }

    async function fetchProjectCustomers() {
      try {
        setLoadingCustomers(true);
        const res = await fetch(`${API_BASE}/project-customers/${selectedProjectMap.project_code}`);
        if (res.ok) {
          const data = await res.json();
          setProjectCustomers(data.customers || []);
        } else {
          setProjectCustomers([]);
        }
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        setProjectCustomers([]);
      } finally {
        setLoadingCustomers(false);
      }
    }

    fetchProjectCustomers();
  }, [selectedProjectMap]);

  // Focus and open popup on the map for a specific customer
  const handleFocusCustomer = (c) => {
    if (leafletMapInstanceRef.current) {
      const map = leafletMapInstanceRef.current;
      map.setView([c.latitude, c.longitude], 16);
      
      const customerPopupContent = `
        <div class="p-3 font-sans text-slate-850" style="font-family: 'Sarabun', sans-serif; min-width: 250px;">
          <div style="border-bottom: 2px solid #0d9488; padding-bottom: 6px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 9px; font-weight: 800; color: #0d9488; text-transform: uppercase; background: #e6f4f1; padding: 2px 6px; border-radius: 4px;">
                ผู้ใช้น้ำขยายเขต
              </span>
              <span style="font-size: 9px; font-weight: 800; color: ${c.status === 'T' ? '#10b981' : '#f59e0b'}; background: ${c.status === 'T' ? '#ecfdf5' : '#fef3c7'}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${c.status === 'T' ? '#a7f3d0' : '#fde68a'}; font-family: 'Sarabun', sans-serif;">
                สถานะ: ${c.status === 'T' ? 'ปกติ (Active)' : c.status || '-'}
              </span>
            </div>
            <h4 style="margin: 6px 0 0 0; font-weight: 800; font-size: 13px; color: #0f172a; line-height: 1.4;">
              ${c.fullName}
            </h4>
          </div>
          <div style="font-size: 11px; color: #475569; display: flex; flex-direction: column; gap: 5px;">
            <div><strong style="color: #64748b;">รหัสผู้ใช้น้ำ:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${c.cus_code}</span></div>
            <div><strong style="color: #64748b;">เลขที่มาตร:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${c.meter_no || '-'}</span></div>
            <div><strong style="color: #64748b;">ขนาดมาตร:</strong> <span style="font-weight: 600; color: #0f172a;">${c.sizeName || '-'} นิ้ว (${c.brandName || '-'})</span></div>
            <div><strong style="color: #64748b;">ประเภทการใช้น้ำ:</strong> <span style="font-weight: 550; color: #0f172a; line-height: 1.3; display: inline-block;">${c.use_Name || '-'}</span></div>
            <div><strong style="color: #64748b;">หน่วยน้ำใช้สะสม:</strong> <span style="font-weight: bold; color: #2563eb;">${c.present_meter_count !== null ? c.present_meter_count.toLocaleString() : '0'} ลบ.ม.</span></div>
            <div style="border-top: 1px dashed #e2e8f0; margin-top: 4px; padding-top: 4px;"><strong style="color: #64748b;">ที่อยู่:</strong> <span style="font-weight: 450; color: #334155; line-height: 1.3; display: block; margin-top: 2px;">${c.full_address || '-'}</span></div>
          </div>
        </div>
      `;
      
      L.popup({ maxWidth: 260, minWidth: 180 })
        .setLatLng([c.latitude, c.longitude])
        .setContent(customerPopupContent)
        .openOn(map);
    }
  };

  // Clear Filters
  const resetFilters = () => {
    setFilterYear('all');
    setFilterBranch('all');
    setFilterType('all');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Filtered Projects for Screen 1
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesYear = filterYear === 'all' || p.completion_year === parseInt(filterYear);
      const matchesBranch = filterBranch === 'all' || p.branch_name === filterBranch;
      const matchesType = filterType === 'all' || p.project_type === parseInt(filterType);
      const matchesSearch = searchTerm === '' || 
        p.project_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.contract_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.branch_name.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesYear && matchesBranch && matchesType && matchesSearch;
    });
  }, [projects, filterYear, filterBranch, filterType, searchTerm]);

  // Projects to display on the map
  const mapProjects = useMemo(() => {
    if (selectedProjectMap) {
      return [selectedProjectMap].filter(p => p.latitude && p.longitude);
    }
    return filteredProjects.filter(p => p.latitude && p.longitude);
  }, [filteredProjects, selectedProjectMap]);

  // Leaflet Map Initialization and Pin Rendering for Projects
  const mapRef = useRef(null);
  const leafletMapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Remove previous map instance if it exists to prevent "Map already initialized" error
    if (leafletMapInstanceRef.current) {
      leafletMapInstanceRef.current.remove();
      leafletMapInstanceRef.current = null;
    }

    const defaultCenter = [16.4322, 102.8231]; // Khon Kaen Center
    const zoomLevel = mapProjects.length > 0 ? (selectedProjectMap ? 13 : 10) : 9;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: zoomLevel,
      zoomControl: true,
      attributionControl: true
    });

    leafletMapInstanceRef.current = map;

    // Use high-quality OpenStreetMap carto tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    if (mapProjects.length > 0) {
      const bounds = [];

      mapProjects.forEach((p, idx) => {
        if (p.latitude && p.longitude) {
          const markerLatLng = [p.latitude, p.longitude];
          bounds.push(markerLatLng);

          // Premium custom marker icon with pulsing wave underneath
          const customIcon = L.divIcon({
            className: 'custom-leaflet-marker',
            html: `
              <div class="relative flex items-center justify-center">
                <span class="absolute inline-flex h-8 w-8 rounded-full bg-cyan-400/50 animate-ping"></span>
                <div class="relative w-7 h-7 bg-gradient-to-tr from-blue-600 to-cyan-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                  ${idx + 1}
                </div>
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -10]
          });

          const popupContent = `
            <div class="p-2 font-sans text-slate-800" style="font-family: 'Sarabun', sans-serif; min-width: 240px;">
              <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 6px; margin-bottom: 6px;">
                <span style="font-size: 10px; font-weight: 800; color: #3b82f6; text-transform: uppercase;">
                  ${PROJECT_TYPES_SHORT[p.project_type] || 'โครงการ'}
                </span>
                <h4 style="margin: 2px 0 0 0; font-weight: 800; font-size: 13px; color: #1f2937; line-height: 1.4;">
                  ${p.project_name}
                </h4>
              </div>
              <div style="font-size: 11px; color: #4b5563; display: flex; flex-direction: column; gap: 4px;">
                <div><strong style="color: #6b7280;">รหัสโครงการ:</strong> <span style="font-family: monospace; font-weight: bold; color: #111827;">${p.project_code}</span></div>
                <div><strong style="color: #6b7280;">เลขที่สัญญา:</strong> <span style="font-family: monospace; font-weight: bold; color: #111827;">${p.contract_no || '-'}</span></div>
                <div><strong style="color: #6b7280;">กปภ.สาขา:</strong> <span style="font-weight: 600; color: #111827;">${p.branch_name}</span></div>
                <div><strong style="color: #6b7280;">ปีที่แล้วเสร็จ:</strong> <span style="font-weight: 600; color: #111827;">พ.ศ. ${p.completion_year}</span></div>
                <div><strong style="color: #6b7280;">งบประมาณ:</strong> <span style="font-weight: bold; color: #111827;">${parseFloat(p.budget).toLocaleString('th-TH')} บาท</span></div>
                <div><strong style="color: #6b7280;">เป้าหมายผู้ใช้:</strong> <span style="font-weight: bold; color: #111827;">${p.target_users} ราย</span></div>
                <div><strong style="color: #6b7280;">ผู้ใช้จริงสะสม:</strong> <span style="font-weight: bold; color: #ef4444;">${p.total_actual_users || 0} ราย</span></div>
                <div style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between; background: #f3f4f6; padding: 6px 8px; border-radius: 6px;">
                  <strong style="color: #374151;">% ความสำเร็จ:</strong>
                  <span style="font-weight: 800; color: ${
                    parseFloat(p.achievement_rate) >= 100 ? '#10b981' : 
                    parseFloat(p.achievement_rate) >= 70 ? '#f59e0b' : '#ef4444'
                  };">${p.achievement_rate}%</span>
                </div>
              </div>
            </div>
          `;

          const marker = L.marker(markerLatLng, { icon: customIcon })
            .addTo(map)
            .bindPopup(popupContent, { maxWidth: 280, minWidth: 200 });

          // If no project is selected yet, let clicking the marker select it
          if (!selectedProjectMap) {
            marker.on('click', () => {
              setSelectedProjectMap(p);
            });
          }
        }
      });

      // Render customer coordinates if a project is selected
      if (selectedProjectMap && projectCustomers.length > 0) {
        projectCustomers.forEach((c) => {
          if (c.latitude && c.longitude) {
            const customerLatLng = [c.latitude, c.longitude];
            bounds.push(customerLatLng);

            const customerIcon = L.divIcon({
              className: 'custom-customer-marker',
              html: `
                <div class="relative flex items-center justify-center">
                  <div class="relative w-4 h-4 bg-gradient-to-tr from-teal-500 to-emerald-400 border-2 border-white rounded-full flex items-center justify-center shadow-lg transition-transform duration-150 hover:scale-125 cursor-pointer">
                    <span class="w-1.5 h-1.5 bg-white rounded-full"></span>
                  </div>
                </div>
              `,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
              popupAnchor: [0, -6]
            });

            const customerPopupContent = `
              <div class="p-3 font-sans text-slate-850" style="font-family: 'Sarabun', sans-serif; min-width: 250px;">
                <div style="border-bottom: 2px solid #0d9488; padding-bottom: 6px; margin-bottom: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 9px; font-weight: 800; color: #0d9488; text-transform: uppercase; background: #e6f4f1; padding: 2px 6px; border-radius: 4px;">
                      ผู้ใช้น้ำขยายเขต
                    </span>
                    <span style="font-size: 9px; font-weight: 800; color: ${c.status === 'T' ? '#10b981' : '#f59e0b'}; background: ${c.status === 'T' ? '#ecfdf5' : '#fef3c7'}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${c.status === 'T' ? '#a7f3d0' : '#fde68a'}; font-family: 'Sarabun', sans-serif;">
                      สถานะ: ${c.status === 'T' ? 'ปกติ (Active)' : c.status || '-'}
                    </span>
                  </div>
                  <h4 style="margin: 6px 0 0 0; font-weight: 800; font-size: 13px; color: #0f172a; line-height: 1.4;">
                    ${c.fullName}
                  </h4>
                </div>
                <div style="font-size: 11px; color: #475569; display: flex; flex-direction: column; gap: 5px;">
                  <div><strong style="color: #64748b;">รหัสผู้ใช้น้ำ:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${c.cus_code}</span></div>
                  <div><strong style="color: #64748b;">เลขที่มาตร:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${c.meter_no || '-'}</span></div>
                  <div><strong style="color: #64748b;">ขนาดมาตร:</strong> <span style="font-weight: 600; color: #0f172a;">${c.sizeName || '-'} นิ้ว (${c.brandName || '-'})</span></div>
                  <div><strong style="color: #64748b;">ประเภทการใช้น้ำ:</strong> <span style="font-weight: 550; color: #0f172a; line-height: 1.3; display: inline-block;">${c.use_Name || '-'}</span></div>
                  <div><strong style="color: #64748b;">หน่วยน้ำใช้สะสม:</strong> <span style="font-weight: bold; color: #2563eb;">${c.present_meter_count !== null ? c.present_meter_count.toLocaleString() : '0'} ลบ.ม.</span></div>
                  <div style="border-top: 1px dashed #e2e8f0; margin-top: 4px; padding-top: 4px;"><strong style="color: #64748b;">ที่อยู่:</strong> <span style="font-weight: 450; color: #334155; line-height: 1.3; display: block; margin-top: 2px;">${c.full_address || '-'}</span></div>
                </div>
              </div>
            `;

            L.marker(customerLatLng, { icon: customerIcon })
              .addTo(map)
              .bindPopup(customerPopupContent, { maxWidth: 260, minWidth: 180 });
          }
        });
      }

      // Zoom map to fit markers
      if (bounds.length > 0) {
        if (selectedProjectMap) {
          // If we have customers, fitBounds to show all customers, else zoom in on the project
          if (projectCustomers.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
          } else {
            map.setView(bounds[0], 13);
          }
        } else {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }

    return () => {
      if (leafletMapInstanceRef.current) {
        leafletMapInstanceRef.current.remove();
        leafletMapInstanceRef.current = null;
      }
    };
  }, [mapProjects, selectedProjectMap, projectCustomers]);

  // Sorted & Paginated Projects
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects];
    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredProjects, sortField, sortDirection]);

  const paginatedProjects = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return sortedProjects.slice(startIdx, startIdx + itemsPerPage);
  }, [sortedProjects, currentPage]);

  const totalPages = Math.ceil(sortedProjects.length / itemsPerPage);

  // Handle Sorting Click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Export Datatable to CSV
  const handleExportCSV = () => {
    const headers = ['รหัสโครงการ', 'เลขสัญญา', 'สาขา', 'ชื่อโครงการ', 'ปีเริ่มสร้าง', 'ปีแล้วเสร็จ', 'งบประมาณ', 'ประเภท', 'เป้าหมายผู้ใช้', 'ผู้ใช้จริง'];
    const rows = filteredProjects.map(p => [
      p.project_code,
      p.contract_no,
      p.branch_name,
      p.project_name,
      p.start_year,
      p.completion_year,
      p.budget,
      PROJECT_TYPES_SHORT[p.project_type],
      p.target_users,
      p.total_actual_users
    ]);

    let csvContent = '\uFEFF'; // Add BOM for Excel UTF-8 compatibility
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      const escapedRow = row.map(v => `"${String(v).replace(/"/g, '""')}"`);
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pwa6_projects_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Screen 2 Data Grid aggregation (Branch x Month)
  const monthlyBranchGrid = useMemo(() => {
    const grid = {};
    branches.forEach(b => {
      grid[b.branch_name] = {};
      MONTHS_TH.forEach(m => {
        grid[b.branch_name][m.num] = 0;
      });
    });

    monthlyData.forEach(item => {
      const matchesYear = filterYear === 'all' || item.fiscal_year === parseInt(filterYear);
      const matchesBranch = filterBranch === 'all' || item.branch_name === filterBranch;
      const matchesType = filterType === 'all' || item.project_type === parseInt(filterType);

      if (matchesYear && matchesBranch && matchesType) {
        if (grid[item.branch_name] && grid[item.branch_name][item.month_number] !== undefined) {
          grid[item.branch_name][item.month_number] += item.actual_users;
        }
      }
    });

    return grid;
  }, [branches, monthlyData, filterYear, filterBranch, filterType]);

  // Screen 2 Drill Down List
  const drillDownProjects = useMemo(() => {
    if (!selectedBranchDrill || !selectedMonthDrill || !selectedYearDrill) return [];
    
    const projectsInMonth = [];
    monthlyData.forEach(item => {
      if (
        item.branch_name === selectedBranchDrill &&
        item.month_number === selectedMonthDrill &&
        item.fiscal_year === selectedYearDrill &&
        item.actual_users > 0
      ) {
        projectsInMonth.push({
          project_code: item.project_code,
          project_name: item.project_name,
          project_type: item.project_type,
          actual_users: item.actual_users
        });
      }
    });
    return projectsInMonth;
  }, [monthlyData, selectedBranchDrill, selectedMonthDrill, selectedYearDrill]);

  // KPI Aggregates
  const kpis = useMemo(() => {
    let count = 0;
    let totalBudget = 0;
    let totalTarget = 0;
    let totalActual = 0;

    filteredProjects.forEach(p => {
      count++;
      totalBudget += parseFloat(p.budget);
      totalTarget += parseInt(p.target_users);
      totalActual += parseInt(p.total_actual_users || 0);
    });

    return {
      count,
      totalBudget: totalBudget.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalTarget: totalTarget.toLocaleString('th-TH'),
      totalActual: totalActual.toLocaleString('th-TH'),
      overallAchievement: totalTarget > 0 ? ((totalActual / totalTarget) * 100).toFixed(1) : '0.0'
    };
  }, [filteredProjects]);

  // Recharts Chart 1 Data: Branch breakdown (Target vs Actual)
  const branchChartData = useMemo(() => {
    const branchMap = {};
    branches.forEach(b => {
      branchMap[b.branch_name] = { name: b.branch_name, เป้าหมาย: 0, ผลงานจริง: 0 };
    });

    filteredProjects.forEach(p => {
      if (branchMap[p.branch_name]) {
        branchMap[p.branch_name].เป้าหมาย += parseInt(p.target_users);
        branchMap[p.branch_name].ผลงานจริง += parseInt(p.total_actual_users || 0);
      }
    });

    return Object.values(branchMap);
  }, [branches, filteredProjects]);

  // Recharts Chart 2 Data: Project Type breakdown
  const typeChartData = useMemo(() => {
    const typeMap = {
      1: { name: 'งบลงทุน', เป้าหมาย: 0, ผลงานจริง: 0 },
      2: { name: 'งบอุดหนุน', เป้าหมาย: 0, ผลงานจริง: 0 },
      3: { name: 'งบกระตุ้น', เป้าหมาย: 0, ผลงานจริง: 0 },
      4: { name: 'ท่อเข้าซอย', เป้าหมาย: 0, ผลงานจริง: 0 }
    };

    filteredProjects.forEach(p => {
      if (typeMap[p.project_type]) {
        typeMap[p.project_type].เป้าหมาย += parseInt(p.target_users);
        typeMap[p.project_type].ผลงานจริง += parseInt(p.total_actual_users || 0);
      }
    });

    return Object.values(typeMap);
  }, [filteredProjects]);

  // Recharts Chart 3 Data: Monthly Trend over selected filters
  const monthlyTrendData = useMemo(() => {
    const monthlyTotals = Array(12).fill(0).map((_, idx) => ({
      name: MONTHS_TH[idx].name,
      ผู้ใช้จริง: 0
    }));

    monthlyData.forEach(item => {
      const matchesYear = filterYear === 'all' || item.fiscal_year === parseInt(filterYear);
      const matchesBranch = filterBranch === 'all' || item.branch_name === filterBranch;
      const matchesType = filterType === 'all' || item.project_type === parseInt(filterType);

      if (matchesYear && matchesBranch && matchesType) {
        const mIdx = MONTHS_TH.findIndex(m => m.num === item.month_number);
        if (mIdx !== -1) {
          monthlyTotals[mIdx].ผู้ใช้จริง += item.actual_users;
        }
      }
    });

    return monthlyTotals;
  }, [monthlyData, filterYear, filterBranch, filterType]);

  // Recharts Chart 4 Data: Deep Dive Project Break-even Timeline
  const projectDeepDive = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const breakEvenData = useMemo(() => {
    if (!projectDeepDive) return { chartData: [], timeline: [] };
    
    const type = projectDeepDive.project_type;
    const compYear = projectDeepDive.completion_year;
    
    // We can extract detailed yearly actuals for this project from the database schema or calculate it from projects
    // Wait, the yearly data is stored in the database! But let's build the calculation dynamically based on the project's completion year.
    // The yearly actuals are available in `project_yearly_performance` in backend or we can aggregate them from the monthlyData!
    // Let's aggregate the yearly performance from monthlyData for this specific project!
    const projectMonthly = monthlyData.filter(item => item.project_code === projectDeepDive.project_code);
    
    const yearlyActualsMap = {};
    projectMonthly.forEach(item => {
      yearlyActualsMap[item.fiscal_year] = (yearlyActualsMap[item.fiscal_year] || 0) + item.actual_users;
    });

    if (type === 4) {
      // Type 4: evaluate only in completion year
      const target = parseInt(projectDeepDive.target_users);
      const actual = yearlyActualsMap[compYear] || 0;
      
      return {
        chartData: [
          { name: `ปีที่แล้วเสร็จ (${compYear})`, 'เป้าหมายสะสม': target, 'ผลงานจริงสะสม': actual }
        ],
        timeline: [
          { 
            label: `ปีที่แล้วเสร็จ (${compYear})`,
            alloc: 100,
            target: target,
            actual: actual,
            cumTarget: target,
            cumActual: actual,
            success: actual >= target
          }
        ]
      };
    } else {
      // Types 1-3: 5-year cumulative evaluation starting from completion year (Year 0)
      // allocations: Year 0 + Year 1 = 40%, Year 2 = 15%, Year 3 = 15%, Year 4 = 15%, Year 5 = 15% (Total 100%)
      const allocations = [40, 0, 15, 15, 15, 15];
      const chartData = [];
      const timeline = [];
      
      let cumTarget = 0;
      let cumActual = 0;
      const targetUsers = parseInt(projectDeepDive.target_users);

      for (let i = 0; i <= 5; i++) {
        const currentYear = compYear + i;
        const yearLabel = i === 0 ? `ปีที่แล้วเสร็จ (${currentYear})` : `ปีที่ ${i} (${currentYear})`;
        
        let allocPct = allocations[i];
        let yearTarget = Math.round(targetUsers * (allocPct / 100));
        let yearActual = yearlyActualsMap[currentYear] || 0;

        cumTarget += yearTarget;
        cumActual += yearActual;

        chartData.push({
          name: yearLabel,
          'เป้าหมายสะสม': cumTarget,
          'ผลงานจริงสะสม': cumActual
        });

        timeline.push({
          label: yearLabel,
          alloc: allocPct,
          target: yearTarget,
          actual: yearActual,
          cumTarget: cumTarget,
          cumActual: cumActual,
          success: cumActual >= cumTarget
        });
      }

      return { chartData, timeline };
    }
  }, [projectDeepDive, monthlyData]);

  // Calculate overall break-even statistics per project type
  const breakevenSummary = useMemo(() => {
    const summary = {
      1: { count: 0, breakevenCount: 0, totalTarget: 0, totalActual: 0 },
      2: { count: 0, breakevenCount: 0, totalTarget: 0, totalActual: 0 },
      3: { count: 0, breakevenCount: 0, totalTarget: 0, totalActual: 0 },
      4: { count: 0, breakevenCount: 0, totalTarget: 0, totalActual: 0 }
    };

    projects.forEach(p => {
      const type = p.project_type;
      if (!summary[type]) return;
      
      summary[type].count++;
      summary[type].totalTarget += parseInt(p.target_users);
      summary[type].totalActual += parseInt(p.total_actual_users || 0);

      // Break-even criteria:
      const totalActual = parseInt(p.total_actual_users || 0);
      const totalTarget = parseInt(p.target_users);
      if (totalActual >= totalTarget) {
        summary[type].breakevenCount++;
      }
    });

    return summary;
  }, [projects]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-600 font-sans">
        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-lg font-semibold animate-pulse font-display text-blue-800">กำลังเชื่อมต่อกับระบบฐานข้อมูล MySQL (Port 3306)...</p>
        <p className="text-xs text-slate-400 mt-2">โปรดมั่นใจว่าได้เปิดเซิร์ฟเวอร์ MySQL และ API Server เรียบร้อยแล้ว</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-rose-50 text-rose-800 px-6 text-center font-sans">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold font-display mb-2">ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ฐานข้อมูลได้</h2>
        <p className="max-w-md text-sm text-rose-700 font-light leading-relaxed mb-6">
          {error}
        </p>
        <div className="bg-white p-4 rounded-xl border border-rose-200 text-left text-xs font-mono max-w-lg mb-6 shadow-sm">
          <p className="font-semibold text-rose-800">ขั้นตอนการแก้ไขเบื้องต้น:</p>
          <ol className="list-decimal pl-4 mt-2 space-y-1 text-slate-600">
            <li>ตรวจสอบว่า MySQL Daemon ใน Task Manager/Service เปิดอยู่ (Port 3306)</li>
            <li>รันสคริปต์ <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-bold">node server.js</code> ในโฟลเดอร์ backend</li>
            <li>ตรวจสอบไฟล์ <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600">backend/.env</code> เพื่อยืนยันว่าการเชื่อมต่อ MySQL ถูกต้อง</li>
          </ol>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="flex items-center gap-2 bg-rose-600 text-white font-semibold text-sm px-6 py-2.5 rounded-xl hover:bg-rose-700 transition duration-150 shadow-md"
        >
          <RefreshCw className="w-4 h-4" />
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col justify-between shrink-0 shadow-2xl relative z-10">
        <div>
          {/* Sidebar Header */}
          <div className="p-6 bg-slate-950 flex items-center gap-3 border-b border-slate-800">
            <img 
              src="https://www.sakhononline.com/news/2017/wp-content/uploads/2017/12/กปภ.-LOGO.jpg" 
              alt="PWA Logo" 
              className="w-10 h-10 rounded-full object-cover shadow-md"
            />
            <div>
              <h1 className="text-sm font-bold tracking-wider text-cyan-400 font-display">ระบบขยายเขตผู้ใช้น้ำ</h1>
              <span className="text-[11px] text-slate-400 block font-light">กปภ.เขต 6 (ภาคตะวันออกเฉียงเหนือ)</span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-4 space-y-1">
            <button 
              onClick={() => { setCurrentTab('projects'); resetFilters(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm ${
                currentTab === 'projects' 
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-4 border-cyan-500 pl-3' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              รายโครงการ (Overview)
            </button>

            <button 
              onClick={() => { setCurrentTab('monthly'); resetFilters(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm ${
                currentTab === 'monthly' 
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-4 border-cyan-500 pl-3' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Calendar className="w-5 h-5" />
              รายเดือนรายสาขา (Monthly)
            </button>

            <button 
              onClick={() => { setCurrentTab('breakeven'); resetFilters(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm ${
                currentTab === 'breakeven' 
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-4 border-cyan-500 pl-3' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              ประเมินจุดคุ้มทุน (Break-even)
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 bg-slate-950/70 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2 mb-1 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>MySQL Connected (3306)</span>
          </div>
          <p className="font-light">ฐานข้อมูล: pwa6_expansion</p>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800 font-display">
              {currentTab === 'projects' && 'รายงานข้อมูลผลการเพิ่มขยายเขตจำหน่ายน้ำ รายโครงการ'}
              {currentTab === 'monthly' && 'สถิติจำนวนผู้ใช้น้ำที่เกิดขึ้นจริง รายกปภ.สาขา รายเดือน'}
              {currentTab === 'breakeven' && 'แดชบอร์ดประเมินจุดคุ้มทุนสะสม (Break-even Analysis Dashboard)'}
            </h2>
            <p className="text-xs text-slate-500 font-light">การประปาส่วนภูมิภาคเขต 6 (ครอบคลุม 8 สาขาเป้าหมายยุทธศาสตร์)</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-cyan-50 text-cyan-700 font-display">ปีงบประมาณล่าสุด: 2569</span>
            <button 
              onClick={resetFilters} 
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition duration-150 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        </header>

        {/* Filter Bar */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap gap-4 items-center shrink-0">
          {/* Year Filter */}
          <div className="flex flex-col gap-1 w-44">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">ปีงบประมาณที่แล้วเสร็จ</label>
            <select 
              value={filterYear}
              onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 text-sm rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
            >
              <option value="all">ปีงบประมาณทั้งหมด</option>
              {FISCAL_YEARS.map(y => <option key={y} value={y}>พ.ศ. {y}</option>)}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="flex flex-col gap-1 w-48">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">กปภ.สาขา</label>
            <select 
              value={filterBranch}
              onChange={(e) => { setFilterBranch(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 text-sm rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
            >
              <option value="all">ทุกสาขา ในสังกัด เขต 6</option>
              {branches.map(b => <option key={b.id} value={b.branch_name}>กปภ.สาขา{b.branch_name}</option>)}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1 w-64">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">ประเภทโครงการขยายเขต</label>
            <select 
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
              className="border border-slate-200 text-sm rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
            >
              <option value="all">ประเภทโครงการทั้งหมด (4 ประเภท)</option>
              {Object.entries(PROJECT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">ค้นหาโครงการ</label>
            <div className="relative">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="ค้นหาด้วยรหัส, สัญญา, สาขา หรือชื่อโครงการ..."
                className="w-full border border-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8 space-y-8 flex-1">
          
          {/* --- TAB 1: PROJECTS OVERVIEW --- */}
          {currentTab === 'projects' && (
            <div className="space-y-8 animate-fadeIn">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition duration-200">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">จำนวนโครงการขยายเขต</span>
                    <span className="text-2xl font-bold font-display text-slate-800">{kpis.count} โครงการ</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Layers className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition duration-200">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">วงเงินงบประมาณรวม</span>
                    <span className="text-2xl font-bold font-display text-slate-800">{kpis.totalBudget} <span className="text-xs font-semibold text-slate-400">บาท</span></span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition duration-200">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">เป้าหมายผู้ใช้บริการรวม</span>
                    <span className="text-2xl font-bold font-display text-slate-800">{kpis.totalTarget} <span className="text-xs font-semibold text-slate-400">ราย</span></span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Users className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition duration-200">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">ผู้ใช้จริงสะสม (% บรรลุผล)</span>
                    <span className="text-2xl font-bold font-display text-rose-600">
                      {kpis.totalActual} <span className="text-xs font-semibold text-slate-400">ราย</span>{' '}
                      <span className="text-sm font-bold text-emerald-600">({kpis.overallAchievement}%)</span>
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                    <Award className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Dashboard Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Chart 1: Branch breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 font-display">จำนวนผู้ใช้น้ำเป้าหมายเทียบกับผลงานที่เกิดจริง แยกตาม กปภ.สาขา (ราย)</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={branchChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <YAxis tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <Tooltip contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                        <Bar dataKey="เป้าหมาย" fill="#0B2545" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ผลงานจริง" fill="#E11D48" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Type breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 font-display">จำนวนผู้ใช้น้ำเป้าหมายเทียบกับผลงานที่เกิดจริง แยกตามประเภทงบประมาณโครงการ (ราย)</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <YAxis tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <Tooltip contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                        <Bar dataKey="เป้าหมาย" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ผลงานจริง" fill="#0D9488" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* --- INTERACTIVE MAP WIDGET --- */}
              <div id="project-map-section" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn mb-8">
                <div className="px-8 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 font-display text-base">
                        {selectedProjectMap 
                          ? 'แผนที่แสดงพิกัดรายละเอียดโครงการที่เลือก' 
                          : 'แผนที่แสดงพิกัดโครงการขยายเขตจำหน่ายน้ำทั้งหมด'}
                      </h3>
                      <p className="text-xs text-slate-500 font-light mt-0.5">
                        {selectedProjectMap ? (
                          <>โครงการ: <span className="font-bold text-blue-600">[{selectedProjectMap.project_code}] - {selectedProjectMap.project_name}</span></>
                        ) : (
                          <>แสดงพิกัดเฉลี่ยของโครงการที่ผ่านการคัดกรองจากตัวกรองและกล่องค้นหาหลักด้านบน</>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 font-display">
                      พบพิกัดโครงการ {mapProjects.length} โครงการ
                    </span>
                    {selectedProjectMap && (
                      <button 
                        onClick={() => setSelectedProjectMap(null)}
                        className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition duration-155 active:scale-95 cursor-pointer border border-slate-200"
                        title="กลับสู่มุมมองแผนที่โครงการทั้งหมด"
                      >
                        แสดงทั้งหมด ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 h-[450px]">
                  {/* Map Container */}
                  <div className="lg:col-span-3 h-full relative">
                    {mapProjects.length === 0 && (
                      <div className="absolute inset-0 bg-slate-50 z-[1000] flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
                        <AlertTriangle className="w-12 h-12 text-slate-300 animate-bounce" />
                        <span className="text-sm font-bold text-slate-600">ไม่พบโครงการที่มีพิกัดพิกัดละติจูด/ลองจิจูดในตัวกรองนี้</span>
                        <p className="text-xs max-w-sm text-slate-400 font-light leading-relaxed">
                          ระบบคำนวณพิกัดโครงการจากค่าเฉลี่ยพิกัดของผู้ใช้น้ำในโครงการ โปรดตรวจสอบว่ามีผู้ใช้น้ำที่ถูกระบุพิกัดแล้วในฐานข้อมูล
                        </p>
                      </div>
                    )}
                    <div ref={mapRef} className="w-full h-full z-0" />
                  </div>

                  {/* Sidebar (Project List or Project Details) */}
                  <div className="lg:col-span-1 border-l border-slate-200 bg-slate-50 h-full flex flex-col overflow-hidden">
                    {selectedProjectMap ? (
                      <div className="h-full flex flex-col overflow-hidden bg-white">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700 tracking-wider flex items-center justify-between font-display">
                          <span>รายละเอียดโครงการที่เลือก</span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">ACTIVE</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          <div className="bg-gradient-to-tr from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-100 shadow-sm">
                            <span className="text-[9px] font-black text-blue-600 block uppercase tracking-wider">
                              {PROJECT_TYPES_SHORT[selectedProjectMap.project_type]} • กปภ.สาขา{selectedProjectMap.branch_name}
                            </span>
                            <h4 className="text-xs font-black text-slate-800 mt-1.5 leading-relaxed">{selectedProjectMap.project_name}</h4>
                          </div>
                          
                          <div className="text-xs space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex justify-between border-b border-slate-200/60 pb-1.5"><span className="text-slate-500 font-medium">รหัสโครงการ</span><span className="font-bold text-slate-800 font-mono">{selectedProjectMap.project_code}</span></div>
                            <div className="flex justify-between border-b border-slate-200/60 pb-1.5"><span className="text-slate-500 font-medium">เลขที่สัญญา</span><span className="font-bold text-slate-800 font-mono">{selectedProjectMap.contract_no || '-'}</span></div>
                            <div className="flex justify-between border-b border-slate-200/60 pb-1.5"><span className="text-slate-500 font-medium">ปีงบประมาณ</span><span className="font-bold text-slate-800">พ.ศ. {selectedProjectMap.completion_year}</span></div>
                            <div className="flex justify-between border-b border-slate-200/60 pb-1.5"><span className="text-slate-500 font-medium">งบประมาณ</span><span className="font-bold text-slate-850 font-display">{parseFloat(selectedProjectMap.budget).toLocaleString('th-TH')} บาท</span></div>
                            <div className="flex justify-between border-b border-slate-200/60 pb-1.5"><span className="text-slate-500 font-medium">เป้าหมายผู้ใช้</span><span className="font-bold text-slate-800">{selectedProjectMap.target_users} ราย</span></div>
                            <div className="flex justify-between border-b border-slate-200/60 pb-1.5"><span className="text-slate-500 font-medium">ผู้ใช้จริงสะสม</span><span className="font-bold text-rose-600">{selectedProjectMap.total_actual_users || 0} ราย</span></div>
                            <div className="flex justify-between items-center pt-1"><span className="text-slate-600 font-bold">% ความสำเร็จ</span><span className={`font-extrabold px-2 py-0.5 rounded text-xs ${
                              parseFloat(selectedProjectMap.achievement_rate) >= 100 ? 'bg-emerald-100 text-emerald-800' :
                              parseFloat(selectedProjectMap.achievement_rate) >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>{selectedProjectMap.achievement_rate}%</span></div>
                          </div>
                          
                          {/* Water Users List Section */}
                          <div className="pt-3 border-t border-slate-200">
                            <span className="text-[10px] font-black text-slate-450 block uppercase tracking-wider mb-2">
                              รายชื่อผู้ใช้น้ำ (${loadingCustomers ? '...' : projectCustomers.length} ราย)
                            </span>
                            
                            {loadingCustomers ? (
                              <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                                <span className="text-xs">กำลังโหลดพิกัดผู้ใช้น้ำ...</span>
                              </div>
                            ) : projectCustomers.length > 0 ? (
                              <div className="max-h-[180px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50">
                                {projectCustomers.map((c) => (
                                  <div 
                                    key={c.cus_code}
                                    onClick={() => handleFocusCustomer(c)}
                                    className="p-2 hover:bg-teal-50/50 transition cursor-pointer flex items-start gap-2 group text-left"
                                  >
                                    <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5 group-hover:scale-110 transition" />
                                    <div className="min-w-0 flex-1">
                                      <h5 className="text-[11px] font-bold text-slate-700 truncate group-hover:text-teal-700 transition">{c.fullName}</h5>
                                      <p className="text-[9px] text-slate-450 font-mono">มาตร: {c.meter_no || '-'}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-[11px] italic">
                                ไม่พบข้อมูลพิกัดผู้ใช้น้ำในโครงการนี้
                              </div>
                            )}
                          </div>

                          <button 
                            onClick={() => setSelectedProjectMap(null)}
                            className="w-full text-center text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl border border-slate-200 transition duration-155 active:scale-97 cursor-pointer mt-4"
                          >
                            กลับไปแสดงโครงการทั้งหมด
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 border-b border-slate-200 bg-white font-bold text-xs text-slate-600 tracking-wider flex items-center justify-between font-display">
                          <span>รายชื่อโครงการที่มีพิกัด</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-500 font-bold">{mapProjects.length} โครงการ</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                          {mapProjects.map((p, idx) => (
                            <div 
                              key={p.project_code} 
                              className="p-3 bg-white hover:bg-blue-50/40 transition duration-150 cursor-pointer flex gap-3 items-start group"
                              onClick={() => {
                                setSelectedProjectMap(p);
                                if (leafletMapInstanceRef.current) {
                                  leafletMapInstanceRef.current.setView([p.latitude, p.longitude], 13);
                                }
                              }}
                            >
                              <div className="w-5.5 h-5.5 rounded-full bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-700 flex items-center justify-center text-[10px] font-extrabold text-slate-500 shrink-0 mt-0.5">
                                {idx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] font-bold text-slate-400 block uppercase">{PROJECT_TYPES_SHORT[p.project_type]} • กปภ.สาขา{p.branch_name}</span>
                                <h4 className="text-xs font-bold text-slate-700 line-clamp-1 group-hover:text-blue-800 transition mt-0.5">{p.project_name}</h4>
                                <div className="flex items-center justify-between mt-1.5 text-[10px]">
                                  <span className="font-mono text-slate-450">รหัส: {p.project_code}</span>
                                  <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{p.achievement_rate}%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {mapProjects.length === 0 && (
                            <div className="p-6 text-center text-xs text-slate-400 italic">ไม่มีข้อมูลพิกัดโครงการ</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Datatable Section */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 font-display">ตารางรายละเอียดโครงการและการบรรลุผลสำเร็จ</h3>
                    <p className="text-xs text-slate-500 font-light">แสดงผลรวมผู้ใช้น้ำจริงเทียบกับเป้าหมายสะสม ค้นหาและคัดกรองได้อิสระ</p>
                  </div>
                  <button 
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-slate-900 text-white font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-800 transition duration-150 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    ส่งออกข้อมูลเป็น CSV (Excel)
                  </button>
                </div>

                {/* Table element */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                        <th onClick={() => handleSort('project_code')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">รหัสโครงการ ⇅</th>
                        <th className="px-6 py-4">เลขที่สัญญา</th>
                        <th onClick={() => handleSort('branch_name')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">กปภ.สาขา ⇅</th>
                        <th className="px-6 py-4">ชื่อโครงการ</th>
                        <th onClick={() => handleSort('completion_year')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap text-center">ปีแล้วเสร็จ ⇅</th>
                        <th onClick={() => handleSort('budget')} className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">วงเงิน (บาท) ⇅</th>
                        <th className="px-6 py-4">ประเภทโครงการ</th>
                        <th className="px-6 py-4 text-right">เป้าหมาย (ราย)</th>
                        <th className="px-6 py-4 text-right">เกิดจริงสะสม (ราย)</th>
                        <th className="px-6 py-4 text-center">% ความสำเร็จ</th>
                        <th className="px-6 py-4 text-center">แผนที่</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {paginatedProjects.length > 0 ? (
                        paginatedProjects.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 font-bold text-slate-800 font-display">{p.project_code}</td>
                            <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap font-medium">{p.contract_no}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 w-fit">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {p.branch_name}
                              </span>
                            </td>
                            <td className="px-6 py-4 max-w-sm truncate text-xs font-semibold text-slate-700" title={p.project_name}>{p.project_name}</td>
                            <td className="px-6 py-4 text-center font-semibold text-slate-700">{p.completion_year}</td>
                            <td className="px-6 py-4 text-right font-display font-semibold">{parseFloat(p.budget).toLocaleString('th-TH')}</td>
                            <td className="px-6 py-4 text-xs">
                              <span className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap ${
                                p.project_type === 1 ? 'bg-blue-50 text-blue-700' :
                                p.project_type === 2 ? 'bg-amber-50 text-amber-700' :
                                p.project_type === 3 ? 'bg-purple-50 text-purple-700' :
                                'bg-rose-50 text-rose-700'
                              }`}>
                                {PROJECT_TYPES_SHORT[p.project_type]}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-extrabold text-slate-800">{p.target_users}</td>
                            <td className="px-6 py-4 text-right font-extrabold text-rose-500">{p.total_actual_users}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-block font-bold px-2 py-0.5 rounded text-xs ${
                                parseFloat(p.achievement_rate) >= 100 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : parseFloat(p.achievement_rate) >= 70 
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                              }`}>
                                {p.achievement_rate}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                disabled={parseInt(p.total_actual_users) === 0}
                                onClick={() => {
                                  setSelectedProjectMap(p);
                                  setTimeout(() => {
                                    const element = document.getElementById('project-map-section');
                                    if (element) {
                                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }, 200);
                                }}
                                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition duration-150 active:scale-95 cursor-pointer border ${
                                  parseInt(p.total_actual_users) === 0 
                                    ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300 shadow-sm'
                                }`}
                                title={parseInt(p.total_actual_users) === 0 ? "ยังไม่มีผู้ใช้น้ำที่ขยายเขตเสร็จสิ้น" : "ดูพิกัดแผนที่ผู้ใช้น้ำ"}
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                พิกัด
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="11" className="px-6 py-12 text-center text-slate-400 italic">ไม่พบโครงการที่ตรงกับเงื่อนไขการค้นหา</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-8 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">แสดงผลหน้าที่ {currentPage} จากทั้งหมด {totalPages} หน้า (จำนวนโครงการที่พบ {sortedProjects.length} โครงการ)</span>
                    <div className="flex gap-2">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-50 font-bold active:scale-95 transition cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        ก่อนหน้า
                      </button>
                      <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-50 font-bold active:scale-95 transition cursor-pointer"
                      >
                        ถัดไป
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- TAB 2: MONTHLY BRANCH PERFORMANCE --- */}
          {currentTab === 'monthly' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Summary Trend Card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Text info and trend */}
                <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
                  <div>
                    <span className="text-xs text-cyan-400 uppercase tracking-widest block mb-2 font-bold font-display">สรุปความสำเร็จรายเดือน</span>
                    <h4 className="text-lg font-bold font-display leading-snug mb-3">เปรียบเทียบสถิติยอดผู้ใช้น้ำรายสาขาแยกรายเดือน</h4>
                    <p className="text-xs text-slate-400 font-light leading-relaxed">
                      ปีงบประมาณของ กปภ.ข.6 จะเริ่มต้นตั้งแต่เดือน ตุลาคม ไปสิ้นสุดในเดือน กันยายน ของปีถัดไป การตรวจสอบแบบ Matrix Grid จะช่วยให้เห็นว่าสาขาใดมียอดผู้ใช้ขยายเขตบรรลุเป้าหมายสูงสุดในแต่ละช่วงฤดูกาล
                    </p>
                  </div>
                  <div className="pt-6 border-t border-slate-800 text-xs text-slate-400 leading-relaxed">
                    💡 <span className="font-bold text-slate-200">คำแนะนำ:</span> ท่านสามารถคลิกที่ตัวเลขของสาขาในตาราง Matrix Grid ด้านล่าง เพื่อเจาะลึกดูรายการโครงการย่อยทั้งหมดที่เกิดขึ้นในจุดนั้นได้ทันที!
                  </div>
                </div>

                {/* Chart 3: Trend Line */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 font-display">แนวโน้มจำแนกตามเดือน (ผลงานผู้ใช้เกิดขึ้นจริงรายเดือนปีที่เลือก)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <YAxis tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <Tooltip contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                        <Line type="monotone" dataKey="ผู้ใช้จริง" stroke="#0056B3" strokeWidth={3} activeDot={{ r: 8 }} dot={{ fill: '#E11D48', strokeWidth: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Grid Table Matrix (Heatmap grid) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex items-center gap-2">
                  <Grid className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-slate-800 font-display">ตารางผลการดำเนินงานแบบ Matrix Grid (จำแนกรายเดือน-รายสาขา)</h3>
                    <p className="text-xs text-slate-500 font-light">แสดงผลรวมผู้ใช้น้ำเกิดจริงในแต่ละเดือน (ตัวเลขเข้มขึ้นหมายถึงประสิทธิภาพขยายเขตที่สูงขึ้น คลิกแถว/เซลล์เพื่อเปิดดูโครงการ)</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-bold uppercase">
                        <th className="px-6 py-4 bg-slate-100 font-bold font-display whitespace-nowrap">กปภ.สาขา (เขต 6)</th>
                        {MONTHS_TH.map(m => (
                          <th key={m.num} className="px-4 py-4 text-center font-bold text-[11px] whitespace-nowrap">{m.name}</th>
                        ))}
                        <th className="px-6 py-4 text-right bg-indigo-50 font-bold text-slate-800 whitespace-nowrap">ผลงานรวมจริง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {branches.map(branch => {
                        let branchTotal = 0;
                        return (
                          <tr key={branch.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 font-bold text-slate-800 bg-slate-50/70 border-r border-slate-100 whitespace-nowrap">
                              กปภ.สาขา{branch.branch_name}
                            </td>
                            {MONTHS_TH.map(m => {
                              const actualVal = monthlyBranchGrid[branch.branch_name]?.[m.num] || 0;
                              branchTotal += actualVal;
                              
                              let bgClass = 'bg-transparent';
                              let textClass = 'text-slate-500 font-normal';
                              if (actualVal > 25) {
                                bgClass = 'bg-emerald-100/70';
                                textClass = 'text-emerald-800 font-bold';
                              } else if (actualVal > 15) {
                                bgClass = 'bg-teal-50';
                                textClass = 'text-teal-700 font-bold';
                              } else if (actualVal > 5) {
                                bgClass = 'bg-slate-50';
                                textClass = 'text-slate-800 font-semibold';
                              }

                              return (
                                <td 
                                  key={m.num} 
                                  onClick={() => {
                                    setSelectedBranchDrill(branch.branch_name);
                                    setSelectedMonthDrill(m.num);
                                    setSelectedYearDrill(filterYear === 'all' ? 2564 : parseInt(filterYear));
                                  }}
                                  className={`px-4 py-4 text-center cursor-pointer transition duration-150 border-r border-slate-100/50 hover:bg-blue-50/80 ${bgClass} ${textClass}`}
                                  title="คลิกเจาะลึกดูความเคลื่อนไหวรายโครงการ"
                                >
                                  {actualVal}
                                </td>
                              );
                            })}
                            <td className="px-6 py-4 text-right font-display font-bold text-blue-600 bg-indigo-50 border-l border-slate-100 whitespace-nowrap">
                              {branchTotal} ราย
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Drill-down Detail Modal / Section */}
              {selectedBranchDrill && (
                <div className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-2xl border-2 border-cyan-500/30 shadow-lg animate-fadeIn">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-6 rounded bg-rose-500"></div>
                      <div>
                        <h4 className="font-bold text-slate-800 font-display">ข้อมูลเจาะลึกโครงการย่อย (Drill-down Results)</h4>
                        <p className="text-xs text-slate-500 font-light">
                          กปภ.สาขา{selectedBranchDrill} ประจำเดือน <span className="font-bold text-blue-600">{MONTHS_TH.find(m => m.num === selectedMonthDrill)?.name}</span> ปีงบประมาณ <span className="font-bold text-blue-600">พ.ศ. {selectedYearDrill}</span>
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedBranchDrill(null)}
                      className="text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      ปิดการเจาะลึก ✕
                    </button>
                  </div>

                  {drillDownProjects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {drillDownProjects.map((p, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-300 transition duration-150">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block tracking-wider">{p.project_code} • {PROJECT_TYPES_SHORT[p.project_type]}</span>
                            <h5 className="text-xs font-bold text-slate-700 mt-1 line-clamp-1">{p.project_name}</h5>
                          </div>
                          <div className="text-right whitespace-nowrap pl-4">
                            <span className="text-sm font-extrabold text-rose-600 font-display block">+{p.actual_users} ราย</span>
                            <span className="text-[9px] font-bold text-slate-400">เกิดขึ้นในเดือนนี้</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic text-center py-6">ไม่มีโครงการเปิดทำงานจำหน่ายน้ำ หรือไม่มียอดผู้ใช้น้ำเกิดขึ้นในช่วงเดือนนี้</p>
                  )}
                </div>
              )}

            </div>
          )}

          {/* --- TAB 3: BREAKEVEN POINT ANALYZER --- */}
          {currentTab === 'breakeven' && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Break-even overview by category */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(type => {
                  const stats = breakevenSummary[type] || { count: 0, breakevenCount: 0, totalTarget: 0, totalActual: 0 };
                  const pct = stats.count > 0 ? ((stats.breakevenCount / stats.count) * 100).toFixed(0) : '0';
                  
                  return (
                    <div key={type} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">ประเภทที่ {type}</span>
                        <h4 className="text-xs font-bold text-slate-700 mt-1 line-clamp-1">{PROJECT_TYPES_SHORT[type]}</h4>
                        
                        <div className="my-4 flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-slate-800 font-display">{stats.breakevenCount}</span>
                          <span className="text-xs text-slate-400 font-medium">จาก {stats.count} โครงการคุ้มทุนแล้ว</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                          <span>อัตราการบรรลุคุ้มทุน</span>
                          <span className="text-blue-600">{pct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-cyan-400 to-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Deep Dive interactive Project Analyzer */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
                <div className="flex flex-wrap gap-4 items-center justify-between border-b border-slate-100 pb-5">
                  <div>
                    <h3 className="font-bold text-slate-800 font-display text-lg">เครื่องมือประเมินจุดคุ้มทุนสะสมรายปี (Project Deep-Dive Payback Analyzer)</h3>
                    <p className="text-xs text-slate-500 font-light">เลือกโครงการขยายเขตผู้ใช้น้ำที่ต้องการ เพื่อดึงเส้นเป้าหมายตามเกณฑ์ 5 ปี สะสมเปรียบเทียบผลลัพธ์จริง</p>
                  </div>
                  
                  {/* Project Search Selector */}
                  <div className="w-96 flex flex-col gap-1">
                    <label className="text-[10px] font-extrabold text-slate-400 tracking-wider">เลือกโครงการที่ต้องการประเมินจุดคุ้มทุน</label>
                    <select 
                      value={selectedProjectId || ''}
                      onChange={(e) => setSelectedProjectId(parseInt(e.target.value))}
                      className="border-2 border-blue-600/30 text-sm font-bold rounded-xl px-4 py-2.5 bg-blue-50/20 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer w-full"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>[{p.project_code}] - {p.project_name.substring(0, 50)}...</option>
                      ))}
                    </select>
                  </div>
                </div>

                {projectDeepDive && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Analytical Info Panel */}
                    <div className="space-y-6 lg:col-span-1">
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
                        <span className="text-xs font-bold text-cyan-600 block mb-1">รายละเอียดโครงการ</span>
                        <h4 className="font-bold text-slate-850 text-sm leading-relaxed font-display">{projectDeepDive.project_name}</h4>
                        
                        <table className="w-full text-xs mt-4 divide-y divide-slate-200">
                          <tbody>
                            <tr className="py-2.5 flex justify-between"><td className="text-slate-400 font-medium">รหัสโครงการ</td><td className="font-bold text-slate-700">{projectDeepDive.project_code}</td></tr>
                            <tr className="py-2.5 flex justify-between"><td className="text-slate-400 font-medium">เลขที่สัญญา</td><td className="font-bold text-slate-700">{projectDeepDive.contract_no}</td></tr>
                            <tr className="py-2.5 flex justify-between"><td className="text-slate-400 font-medium">วงเงินทั้งหมด</td><td className="font-bold text-slate-750 font-display">{parseFloat(projectDeepDive.budget).toLocaleString()} บาท</td></tr>
                            <tr className="py-2.5 flex justify-between"><td className="text-slate-400 font-medium">เป้าหมายผู้ใช้น้ำ</td><td className="font-bold text-slate-800">{projectDeepDive.target_users} ราย</td></tr>
                            <tr className="py-2.5 flex justify-between"><td className="text-slate-400 font-medium">เกิดจริงสะสมขณะนี้</td><td className="font-bold text-rose-600">{projectDeepDive.total_actual_users} ราย</td></tr>
                            <tr className="py-2.5 flex justify-between"><td className="text-slate-400 font-medium">เกณฑ์การคิดจุดคุ้มทุน</td><td className="font-bold text-blue-600">{projectDeepDive.project_type === 4 ? 'ประเมิน 1 ปีที่แล้วเสร็จ' : 'ประเมินสะสม 5 ปี'}</td></tr>
                          </tbody>
                        </table>

                        {/* Status Badge */}
                        <div className="mt-6">
                          {parseInt(projectDeepDive.total_actual_users || 0) >= parseInt(projectDeepDive.target_users) ? (
                            <div className="w-full bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl font-extrabold text-center text-sm shadow-sm flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              บรรลุจุดคุ้มทุนตามเป้าหมาย ({projectDeepDive.achievement_rate}%)
                            </div>
                          ) : (
                            <div className="w-full bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl font-extrabold text-center text-sm flex items-center justify-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                              อยู่ระหว่างพัฒนา/ยังไม่คุ้มทุน ({projectDeepDive.achievement_rate}%)
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Technical Note */}
                      <div className="p-4 bg-slate-900 text-slate-400 rounded-xl text-xs space-y-2 leading-relaxed">
                        <span className="font-bold text-cyan-400 block font-display">📌 เกณฑ์คิดจุดคุ้มทุน กปภ.ข.6:</span>
                        {projectDeepDive.project_type === 4 ? (
                          <p>เนื่องจากเป็น <strong className="text-slate-200">"โครงการประเภท 4: โครงการวางท่อเข้าซอย"</strong> จะคิดคุ้มทุนเพียง 1 ปี คือในปีงบประมาณที่แล้วเสร็จเป็นหลัก โดยผลลัพธ์จริงต้องได้เท่ากับเป้าหมาย (100%) ทันที</p>
                        ) : (
                          <p>เนื่องจากเป็น <strong className="text-slate-200">"โครงการประเภท 1-3: โครงการจำหน่ายน้ำ"</strong> จะใช้เกณฑ์ประเมินสะสมขยายเขตสะสม 5 ปี โดยเฉลี่ยปีที่แล้วเสร็จ (ปี 0) = 40% และปี 1-4 = ปีละ 15%</p>
                        )}
                      </div>
                    </div>

                    {/* Chart and Milestone Timeline Grid */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Live Payback Chart */}
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
                        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3">กราฟวิเคราะห์แนวโน้มจุดคุ้มทุนสะสม (Cumulative Targets vs Actual)</h4>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={breakEvenData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                              <YAxis tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                              <Tooltip contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                              <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                              <Line type="monotone" dataKey="เป้าหมายสะสม" stroke="#0B2545" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
                              <Line type="monotone" dataKey="ผลงานจริงสะสม" stroke="#E11D48" strokeWidth={4} activeDot={{ r: 8 }} dot={{ fill: '#E11D48', r: 5 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Milestone Timeline cards */}
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3 font-display">ไทม์ไลน์บันทึกเป้าหมายการขยายเขตรายปี (Milestone Payback Tracker)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                          {breakEvenData.timeline.map((yr, idx) => (
                            <div key={idx} className={`p-3 rounded-xl border transition-all duration-200 shadow-sm ${
                              yr.success 
                                ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300' 
                                : 'bg-white border-slate-200 hover:border-blue-300'
                            }`}>
                              <span className="text-[10px] font-extrabold text-slate-400 block tracking-tight line-clamp-1">{yr.label}</span>
                              <span className="text-xs font-bold text-blue-900 block mt-1">สัดส่วน: {yr.alloc}%</span>
                              
                              <div className="mt-3 space-y-1 text-[11px] leading-tight">
                                <div className="flex justify-between"><span className="text-slate-400 font-medium">เป้าปีนี้:</span><span className="font-bold text-slate-700">{yr.target}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400 font-medium">เกิดจริงปีนี้:</span><span className="font-bold text-slate-700">{yr.actual}</span></div>
                                <hr className="my-1 border-slate-100" />
                                <div className="flex justify-between"><span className="text-slate-500 font-bold">เป้าสะสม:</span><span className="font-extrabold text-slate-800">{yr.cumTarget}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500 font-bold">จริงสะสม:</span><span className={`font-extrabold ${yr.success ? 'text-emerald-700' : 'text-rose-500'}`}>{yr.cumActual}</span></div>
                              </div>

                              <div className="mt-3 flex justify-center">
                                {yr.success ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold flex items-center gap-0.5 w-full justify-center">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> คุ้มทุน
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[9px] font-extrabold flex items-center gap-0.5 w-full justify-center">
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-500" /> พัฒนา
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
