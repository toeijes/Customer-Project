import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Layers, Search, Download, RefreshCw, CheckCircle2, AlertTriangle, 
  Calendar, DollarSign, Users, Award, ChevronLeft, ChevronRight,
  Database, Briefcase, MapPin, Grid, BarChart3, TrendingUp, Menu, Edit3, Target, LogOut, ShieldCheck, PieChart, Droplets
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Login from './components/Login';
import AdminManagement from './components/AdminManagement';

const PROJECT_TYPES = {
  1: 'โครงการขยายเขตจำหน่ายน้ำ (เงินรายได้)',
  2: 'โครงการขยายเขตจำหน่ายน้ำ (เงินอุดหนุน)',
  3: 'โครงการขยายเขตจำหน่ายน้ำ (กระตุ้นเศรษฐกิจ)',
  4: 'โครงการวางท่อเข้าซอย'
};

const PROJECT_TYPES_SHORT = {
  1: 'เงินรายได้',
  2: 'เงินอุดหนุน',
  3: 'กระตุ้นเศรษฐกิจ',
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

const FISCAL_YEARS = [2569, 2568, 2567, 2566, 2565, 2564];

const convertToBE = (val) => {
  if (!val) return '';
  if (val.includes('/')) return val;
  const parts = val.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10) + 543;
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return `${d}/${m}/${y}`;
  }
  return val;
};

const convertToGregorian = (val) => {
  if (!val) return '';
  if (val.includes('-')) return val;
  const parts = val.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parseInt(parts[2], 10) - 543;
    return `${y}-${m}-${d}`;
  }
  return val;
};

const parseBEParts = (dateStr) => {
  if (!dateStr) return { day: '', month: '', year: '' };
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return {
      day: parts[0],
      month: parts[1],
      year: parts[2]
    };
  }
  return { day: '', month: '', year: '' };
};

function MainApp({ user, onLogout }) {
  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  const [currentTab, setCurrentTab] = useState('projects'); // 'projects', 'monthly', 'breakeven', 'water-usage'
  const [breakevenModalType, setBreakevenModalType] = useState(null);
  
  // Water Usage State
  const [waterUsageData, setWaterUsageData] = useState(null);
  const [waterUsageLoading, setWaterUsageLoading] = useState(false);
  const [isWaterUsageModalOpen, setIsWaterUsageModalOpen] = useState(false);
  const [selectedWaterUsageProject, setSelectedWaterUsageProject] = useState(null);
  const [waterUsageModalCustomers, setWaterUsageModalCustomers] = useState([]);
  const [loadingWaterUsageModalCustomers, setLoadingWaterUsageModalCustomers] = useState(false);
  const [waterUsageModalSearch, setWaterUsageModalSearch] = useState('');
  const [waterUsageTableSearch, setWaterUsageTableSearch] = useState('');
  const [waterUsageCurrentPage, setWaterUsageCurrentPage] = useState(1);
  const waterUsageItemsPerPage = 10;
  
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
  const [sortField, setSortField] = useState('ba');
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

  // Customer Modal States
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedProjectForCustomers, setSelectedProjectForCustomers] = useState(null);
  const [modalCustomers, setModalCustomers] = useState([]);
  const [loadingModalCustomers, setLoadingModalCustomers] = useState(false);
  const [modalCustomerSearch, setModalCustomerSearch] = useState('');

  // Contract Number Editor States
  const [editingProject, setEditingProject] = useState(null);
  const [newContractNo, setNewContractNo] = useState('');
  const [editCompletedDate, setEditCompletedDate] = useState('');
  const [isUpdatingContract, setIsUpdatingContract] = useState(false);

  // Add Project Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addProjectForm, setAddProjectForm] = useState({
    project_code: '',
    contract_no: '',
    branch_name: '',
    project_name: '',
    project_type: '1',
    start_year: new Date().getFullYear() + 543,
    completed_date: '',
    budget: '',
    target_users: '',
    latitude: '',
    longitude: ''
  });
  const [addError, setAddError] = useState(null);
  const [addLoading, setAddLoading] = useState(false);

  // Table Local Search State
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  // Sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Contract Number Editor Handlers
  const fetchProjectsOnly = async () => {
    try {
      const resProjects = await fetch(`${API_BASE}/projects`);
      if (resProjects.ok) {
        const dataProjects = await resProjects.json();
        setProjects(dataProjects);
        
        // Also refresh selected project map if it's currently selected
        if (selectedProjectMap) {
          const updatedProj = dataProjects.find(p => p.project_code === selectedProjectMap.project_code);
          if (updatedProj) setSelectedProjectMap(updatedProj);
        }
      }
    } catch (err) {
      console.error('Failed to refresh projects:', err);
    }
  };
  const handleAddProjectSubmit = async (e) => {
    e.preventDefault();
    if (!addProjectForm.project_code || !addProjectForm.contract_no || !addProjectForm.project_name || !addProjectForm.branch_name || !addProjectForm.project_type || !addProjectForm.start_year || !addProjectForm.budget || !addProjectForm.target_users) {
      setAddError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    try {
      setAddLoading(true);
      setAddError(null);

      // Convert Gregorian YYYY-MM-DD from date input to BE d/m/yyyy format if it's from a datepicker,
      // otherwise use the entered text format directly.
      let formattedCompletedDate = addProjectForm.completed_date ? addProjectForm.completed_date.trim() : '';
      if (formattedCompletedDate) {
        const parts = formattedCompletedDate.split('/');
        if (parts.length !== 3 || parts.some(p => !p)) {
          setAddError('กรุณาเลือกวันที่เสร็จสิ้นโครงการให้ครบถ้วนทั้ง วัน เดือน และปี พ.ศ.');
          return;
        }
      }
      if (formattedCompletedDate.includes('-')) {
        const parts = formattedCompletedDate.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10) + 543;
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          formattedCompletedDate = `${d}/${m}/${y}`;
        }
      }

      const payload = {
        ...addProjectForm,
        completed_date: formattedCompletedDate
      };

      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        alert('สร้างโครงการใหม่สำเร็จเรียบร้อยแล้ว!');
        await fetchProjectsOnly();
        setAddProjectForm({
          project_code: '',
          contract_no: '',
          branch_name: '',
          project_name: '',
          project_type: '1',
          start_year: new Date().getFullYear() + 543,
          completed_date: '',
          budget: '',
          target_users: '',
          latitude: '',
          longitude: ''
        });
        setIsAddModalOpen(false);
      } else {
        setAddError(data.error || 'ไม่สามารถเพิ่มโครงการได้');
      }
    } catch (err) {
      console.error(err);
      setAddError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDateDropdownChange = (type, value) => {
    const currentParts = parseBEParts(addProjectForm.completed_date);
    currentParts[type] = value;
    
    if (currentParts.day || currentParts.month || currentParts.year) {
      setAddProjectForm({
        ...addProjectForm,
        completed_date: `${currentParts.day}/${currentParts.month}/${currentParts.year}`
      });
    } else {
      setAddProjectForm({
        ...addProjectForm,
        completed_date: ''
      });
    }
  };

  const handleOpenEditContractModal = (project) => {
    setEditingProject(project);
    setNewContractNo(project.contract_no || '');
    setEditCompletedDate(project.completed_date || '');
  };

  const handleEditDateDropdownChange = (type, value) => {
    const currentParts = parseBEParts(editCompletedDate);
    currentParts[type] = value;
    
    if (currentParts.day || currentParts.month || currentParts.year) {
      setEditCompletedDate(`${currentParts.day}/${currentParts.month}/${currentParts.year}`);
    } else {
      setEditCompletedDate('');
    }
  };

  const handleSaveContractNo = async () => {
    if (!editingProject) return;

    if (editCompletedDate) {
      const parts = editCompletedDate.split('/');
      if (parts.length !== 3 || parts.some(p => !p)) {
        alert('กรุณาเลือกวันที่เสร็จสิ้นโครงการให้ครบถ้วนทั้ง วัน เดือน และปี พ.ศ. หรือปล่อยว่างทั้งหมด');
        return;
      }
    }

    try {
      setIsUpdatingContract(true);
      const res = await fetch(`${API_BASE}/projects/${editingProject.project_code}/contract`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          contract_no: newContractNo,
          completed_date: editCompletedDate
        }),
      });

      if (res.ok) {
        await fetchProjectsOnly();
        setEditingProject(null);
        setNewContractNo('');
        setEditCompletedDate('');
        alert('บันทึกรายละเอียดโครงการสำเร็จ และระบบได้ทำการคำนวณเชื่อมข้อมูลประเมินผลงานเรียบร้อยแล้ว');
      } else {
        const errData = await res.json();
        alert(`เกิดข้อผิดพลาด: ${errData.error || 'ไม่สามารถบันทึกได้'}`);
      }
    } catch (err) {
      console.error('Failed to update project details:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsUpdatingContract(false);
    }
  };

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
    if (!c.latitude || !c.longitude || isNaN(c.latitude) || isNaN(c.longitude)) {
      alert(`ผู้ใช้น้ำ ${c.fullName || ''} ไม่มีข้อมูลพิกัดละติจูด/ลองจิจูดในระบบ`);
      return;
    }
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
            <div><strong style="color: #64748b;">วันที่เริ่มเป็นผู้ใช้น้ำ:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${c.bgncustdt_formatted || '-'}</span></div>
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
    setTableSearchTerm('');
    setCurrentPage(1);
  };

  // Open Customer Modal and Fetch Data
  const handleOpenCustomerModal = async (project) => {
    setSelectedProjectForCustomers(project);
    setIsCustomerModalOpen(true);
    setLoadingModalCustomers(true);
    setModalCustomerSearch('');
    setModalCustomers([]);

    try {
      const res = await fetch(`${API_BASE}/project-customers/${project.project_code}`);
      if (res.ok) {
        const data = await res.json();
        setModalCustomers(data.customers || []);
      } else {
        setModalCustomers([]);
      }
    } catch (err) {
      console.error('Failed to fetch modal customers:', err);
      setModalCustomers([]);
    } finally {
      setLoadingModalCustomers(false);
    }
  };

  // Filtered customers inside the modal
  const filteredModalCustomers = useMemo(() => {
    if (!modalCustomers) return [];
    return modalCustomers.filter(c => {
      const search = modalCustomerSearch.toLowerCase();
      const fullName = (c.fullName || '').toLowerCase();
      const cusCode = (c.cus_code || '').toLowerCase();
      const meterNo = (c.meter_no || '').toLowerCase();
      const fullAddress = (c.full_address || '').toLowerCase();
      return (
        fullName.includes(search) ||
        cusCode.includes(search) ||
        meterNo.includes(search) ||
        fullAddress.includes(search)
      );
    });
  }, [modalCustomers, modalCustomerSearch]);

  // Export Modal Customers to CSV
  const handleExportModalCustomersCSV = () => {
    if (!selectedProjectForCustomers || filteredModalCustomers.length === 0) return;

    const headers = ['รหัสผู้ใช้น้ำ', 'ชื่อ-นามสกุล', 'เลขที่มาตร', 'วันที่เริ่มเป็นผู้ใช้น้ำ', 'ขนาดมาตร', 'ยี่ห้อมาตร', 'ประเภทการใช้น้ำ', 'หน่วยน้ำใช้สะสม', 'สถานะ', 'ที่อยู่', 'ละติจูด', 'ลองจิจูด'];
    const rows = filteredModalCustomers.map(c => [
      c.cus_code,
      c.fullName,
      c.meter_no || '-',
      c.bgncustdt_formatted || '-',
      c.sizeName || '-',
      c.brandName || '-',
      c.use_Name || '-',
      c.present_meter_count !== null ? c.present_meter_count : 0,
      c.status === 'T' ? 'ปกติ (Active)' : c.status || '-',
      c.full_address || '-',
      c.latitude || '',
      c.longitude || ''
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
    link.setAttribute('download', `customers_${selectedProjectForCustomers.project_code}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Projects for Screen 1
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesYear = filterYear === 'all' || p.start_year === parseInt(filterYear);
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

  // Auto-update selectedProjectId on Break-even tab when filters change
  const sortedBreakevenProjects = useMemo(() => {
    const list = [...filteredProjects];
    return list.sort((a, b) => {
      const rateA = parseFloat(a.achievement_rate || 0);
      const rateB = parseFloat(b.achievement_rate || 0);
      return rateB - rateA;
    });
  }, [filteredProjects]);

  useEffect(() => {
    if (sortedBreakevenProjects.length > 0) {
      const isStillAvailable = sortedBreakevenProjects.some(p => p.id === selectedProjectId);
      if (!isStillAvailable) {
        setSelectedProjectId(sortedBreakevenProjects[0].id);
      }
    } else {
      setSelectedProjectId(null);
    }
  }, [sortedBreakevenProjects, selectedProjectId]);

  // Clear selectedProjectMap if it is no longer in the filtered projects list (e.g. when searching/filtering)
  useEffect(() => {
    if (selectedProjectMap) {
      const isStillAvailable = filteredProjects.some(p => p.project_code === selectedProjectMap.project_code);
      if (!isStillAvailable) {
        setSelectedProjectMap(null);
      }
    }
  }, [filteredProjects, selectedProjectMap]);

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
                <div class="custom-leaflet-marker-pulse"></div>
                <div class="custom-leaflet-marker-core">
                  ${idx + 1}
                </div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -12]
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
                  <div class="custom-customer-marker-core"></div>
                </div>
              `,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
              popupAnchor: [0, -8]
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
                  <div><strong style="color: #64748b;">วันที่เริ่มเป็นผู้ใช้น้ำ:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f172a;">${c.bgncustdt_formatted || '-'}</span></div>
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

  // Locally Filtered Projects for Table Search
  const tableFilteredProjects = useMemo(() => {
    return filteredProjects.filter(p => {
      if (tableSearchTerm === '') return true;
      const search = tableSearchTerm.toLowerCase();
      return (
        p.project_code.toLowerCase().includes(search) ||
        p.project_name.toLowerCase().includes(search) ||
        p.contract_no.toLowerCase().includes(search) ||
        p.branch_name.toLowerCase().includes(search)
      );
    });
  }, [filteredProjects, tableSearchTerm]);

  // Sorted & Paginated Projects
  const sortedProjects = useMemo(() => {
    const sorted = [...tableFilteredProjects];
    sorted.sort((a, b) => {
      const field = sortField === 'branch_name' ? 'ba' : sortField;
      let aVal = a[field];
      let bVal = b[field];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [tableFilteredProjects, sortField, sortDirection]);

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
    const rows = tableFilteredProjects.map(p => [
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

  // Fetch Water Usage Summary Data
  useEffect(() => {
    if (currentTab !== 'water-usage') return;

    setWaterUsageCurrentPage(1);
    setWaterUsageTableSearch('');

    async function fetchWaterUsage() {
      try {
        setWaterUsageLoading(true);
        const params = new URLSearchParams();
        if (filterBranch && filterBranch !== 'all') params.append('branch', filterBranch);
        if (filterYear && filterYear !== 'all') params.append('year', filterYear);
        if (filterType && filterType !== 'all') params.append('type', filterType);

        const res = await fetch(`${API_BASE}/water-usage/summary?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setWaterUsageData(data);
        } else {
          setWaterUsageData(null);
        }
      } catch (err) {
        console.error('Failed to fetch water usage summary:', err);
        setWaterUsageData(null);
      } finally {
        setWaterUsageLoading(false);
      }
    }

    fetchWaterUsage();
  }, [currentTab, filterBranch, filterYear, filterType]);

  // Open Water Usage Project Customers Modal and Fetch Data
  const handleOpenWaterUsageModal = async (project) => {
    setSelectedWaterUsageProject(project);
    setIsWaterUsageModalOpen(true);
    setLoadingWaterUsageModalCustomers(true);
    setWaterUsageModalSearch('');
    setWaterUsageModalCustomers([]);

    try {
      const res = await fetch(`${API_BASE}/project-customers-water-usage/${project.project_code}`);
      if (res.ok) {
        const data = await res.json();
        setWaterUsageModalCustomers(data.customers || []);
      } else {
        setWaterUsageModalCustomers([]);
      }
    } catch (err) {
      console.error('Failed to fetch project water usage customers:', err);
      setWaterUsageModalCustomers([]);
    } finally {
      setLoadingWaterUsageModalCustomers(false);
    }
  };

  // Filtered customers inside the water usage modal
  const filteredWaterUsageModalCustomers = useMemo(() => {
    if (!waterUsageModalCustomers) return [];
    return waterUsageModalCustomers.filter(c => {
      const search = waterUsageModalSearch.toLowerCase();
      const fullName = (c.fullName || '').toLowerCase();
      const cusCode = (c.cus_code || '').toLowerCase();
      const meterNo = (c.meter_no || '').toLowerCase();
      const fullAddress = (c.full_address || '').toLowerCase();
      return (
        fullName.includes(search) ||
        cusCode.includes(search) ||
        meterNo.includes(search) ||
        fullAddress.includes(search)
      );
    });
  }, [waterUsageModalCustomers, waterUsageModalSearch]);

  // Export Water Usage Modal Customers to CSV
  const handleExportWaterUsageModalCustomersCSV = () => {
    if (!selectedWaterUsageProject || filteredWaterUsageModalCustomers.length === 0) return;

    const headers = ['รหัสผู้ใช้น้ำ', 'ชื่อ-นามสกุล', 'เลขที่มาตร', 'ปริมาณใช้น้ำสะสม (ลบ.ม.)', 'รายได้ค่าน้ำสะสม (บาท)', 'ที่อยู่ผู้ใช้น้ำ'];
    const rows = filteredWaterUsageModalCustomers.map(c => [
      c.cus_code,
      c.fullName,
      c.meter_no || '-',
      c.total_usage || 0,
      c.total_amount || 0,
      c.full_address || '-'
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
    link.setAttribute('download', `water_usage_customers_${selectedWaterUsageProject.project_code}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered and Paginated Projects for Water Usage Datatable
  const filteredWaterUsageProjects = useMemo(() => {
    if (!waterUsageData || !waterUsageData.projects) return [];
    
    return waterUsageData.projects.filter(p => {
      const search = waterUsageTableSearch.toLowerCase();
      const pCode = (p.project_code || '').toLowerCase();
      const contract = (p.contract_no || '').toLowerCase();
      const name = (p.project_name || '').toLowerCase();
      const branch = (p.branch_name || '').toLowerCase();
      return (
        pCode.includes(search) ||
        contract.includes(search) ||
        name.includes(search) ||
        branch.includes(search)
      );
    });
  }, [waterUsageData, waterUsageTableSearch]);

  const paginatedWaterUsageProjects = useMemo(() => {
    const startIndex = (waterUsageCurrentPage - 1) * waterUsageItemsPerPage;
    return filteredWaterUsageProjects.slice(startIndex, startIndex + waterUsageItemsPerPage);
  }, [filteredWaterUsageProjects, waterUsageCurrentPage]);

  const waterUsageTotalPages = useMemo(() => {
    return Math.ceil(filteredWaterUsageProjects.length / waterUsageItemsPerPage) || 1;
  }, [filteredWaterUsageProjects]);

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
      const matchesYear = filterYear === 'all' || item.fiscal_year === selectedYearDrill;
      if (
        item.branch_name === selectedBranchDrill &&
        item.month_number === selectedMonthDrill &&
        matchesYear &&
        item.actual_users > 0
      ) {
        projectsInMonth.push({
          project_code: item.project_code,
          project_name: item.project_name,
          project_type: item.project_type,
          actual_users: item.actual_users,
          fiscal_year: item.fiscal_year
        });
      }
    });
    return projectsInMonth;
  }, [monthlyData, selectedBranchDrill, selectedMonthDrill, selectedYearDrill, filterYear]);

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
      totalBudget: totalBudget.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[.,]00$/, ''),
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
      1: { name: 'เงินรายได้', เป้าหมาย: 0, ผลงานจริง: 0 },
      2: { name: 'เงินอุดหนุน', เป้าหมาย: 0, ผลงานจริง: 0 },
      3: { name: 'กระตุ้นเศรษฐกิจ', เป้าหมาย: 0, ผลงานจริง: 0 },
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
    const now = new Date();
    const curMonth = now.getMonth() + 1; // 1-12
    const curYearBE = now.getFullYear() + 543;
    const curFiscalYear = curMonth >= 10 ? curYearBE + 1 : curYearBE;
    
    const selectedYear = parseInt(filterYear);
    
    let monthsToInclude = [...MONTHS_TH];
    
    if (selectedYear === curFiscalYear) {
      const curFiscalIndex = curMonth >= 10 ? curMonth - 10 : curMonth + 2;
      monthsToInclude = MONTHS_TH.filter(m => {
        const mIdx = m.num >= 10 ? m.num - 10 : m.num + 2;
        return mIdx <= curFiscalIndex;
      });
    } else if (selectedYear > curFiscalYear) {
      monthsToInclude = [];
    }

    const monthlyTotals = monthsToInclude.map(m => ({
      name: m.name,
      ผู้ใช้จริง: 0
    }));

    monthlyData.forEach(item => {
      const matchesYear = filterYear === 'all' || item.fiscal_year === selectedYear;
      const matchesBranch = filterBranch === 'all' || item.branch_name === filterBranch;
      const matchesType = filterType === 'all' || item.project_type === parseInt(filterType);

      if (matchesYear && matchesBranch && matchesType) {
        const mIdx = monthsToInclude.findIndex(m => m.num === item.month_number);
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
      // 5-year cumulative evaluation starting from Year 1 (which combines Year 0 and Year 1 actuals)
      // allocations: Year 1 = 40%, Year 2 = 15%, Year 3 = 15%, Year 4 = 15%, Year 5 = 15%
      const allocations = [40, 15, 15, 15, 15];
      const chartData = [];
      const timeline = [];
      
      let cumTarget = 0;
      let cumActual = 0;
      const targetUsers = parseInt(projectDeepDive.target_users);

      for (let i = 1; i <= 5; i++) {
        const currentYear = compYear + i;
        const yearLabel = `ปีที่ ${i} (${currentYear})`;
        
        let allocPct = allocations[i - 1];
        let yearTarget = Math.round(targetUsers * (allocPct / 100));
        
        let yearActual = 0;
        if (i === 1) {
          yearActual = (yearlyActualsMap[compYear] || 0) + (yearlyActualsMap[compYear + 1] || 0);
        } else {
          yearActual = yearlyActualsMap[currentYear] || 0;
        }

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
          success: yearActual >= yearTarget
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

    filteredProjects.forEach(p => {
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
  }, [filteredProjects]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-pwa-blue-light/20 text-slate-650 font-sans">
        <RefreshCw className="w-12 h-12 text-pwa-blue animate-spin mb-4" />
        <p className="text-lg font-semibold animate-pulse font-display text-pwa-blue-dark">กำลังเชื่อมต่อกับระบบฐานข้อมูล MySQL (Port 3306)...</p>
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
    <div className="flex h-screen bg-pwa-blue-light/10 overflow-hidden font-sans text-slate-800">
      
      {/* --- SIDEBAR --- */}
      <aside className={`bg-gradient-to-b from-pwa-blue-dark to-[#041224] text-slate-100 flex flex-col justify-between shrink-0 shadow-2xl relative z-10 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-56' : 'w-0 overflow-hidden opacity-0 pointer-events-none'}`}>
        <div className="w-56 flex flex-col justify-between h-full shrink-0">
          <div>
            {/* Sidebar Header */}
            <div className="relative p-5 bg-pwa-blue-dark/40 flex items-center justify-center border-b border-pwa-blue/20 h-14">
              <h1 className="text-[13px] font-bold tracking-widest text-white font-display leading-tight uppercase">Menu</h1>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="absolute right-3 p-1.5 hover:bg-pwa-blue/30 rounded-lg text-pwa-cyan hover:text-white transition duration-155 cursor-pointer border border-transparent active:scale-95 flex items-center justify-center"
                title="ซ่อนเมนู"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Menu */}
            <nav className="p-4 space-y-1">
              <button 
                onClick={() => { setCurrentTab('projects'); resetFilters(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm cursor-pointer ${
                  currentTab === 'projects' 
                    ? 'bg-gradient-to-r from-pwa-blue to-pwa-blue/70 text-white border-l-4 border-pwa-cyan pl-3 shadow-md' 
                    : 'text-blue-100/80 hover:bg-pwa-blue/20 hover:text-white'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                รายโครงการ
              </button>

              <button 
                onClick={() => { setCurrentTab('monthly'); resetFilters(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm cursor-pointer ${
                  currentTab === 'monthly' 
                    ? 'bg-gradient-to-r from-pwa-blue to-pwa-blue/70 text-white border-l-4 border-pwa-cyan pl-3 shadow-md' 
                    : 'text-blue-100/80 hover:bg-pwa-blue/20 hover:text-white'
                }`}
              >
                <Calendar className="w-5 h-5" />
                รายเดือนรายสาขา
              </button>

              <button 
                onClick={() => { setCurrentTab('breakeven'); resetFilters(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm cursor-pointer ${
                  currentTab === 'breakeven' 
                    ? 'bg-gradient-to-r from-pwa-blue to-pwa-blue/70 text-white border-l-4 border-pwa-cyan pl-3 shadow-md' 
                    : 'text-blue-100/80 hover:bg-pwa-blue/20 hover:text-white'
                }`}
              >
                <Target className="w-[21px] h-[21px] shrink-0" />
                <span className="leading-tight">ประเมินจำนวนผู้ใช้น้ำตามเป้าหมายโครงการ</span>
              </button>

              <button 
                onClick={() => { setCurrentTab('water-usage'); resetFilters(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm cursor-pointer ${
                  currentTab === 'water-usage' 
                    ? 'bg-gradient-to-r from-pwa-blue to-pwa-blue/70 text-white border-l-4 border-pwa-cyan pl-3 shadow-md' 
                    : 'text-blue-100/80 hover:bg-pwa-blue/20 hover:text-white'
                }`}
              >
                <Droplets className="w-5 h-5" />
                ประเมินการใช้น้ำสะสม
              </button>

              {user?.role === 'admin' && (
                <button 
                  onClick={() => { setCurrentTab('admin'); resetFilters(); }}
                  className={`w-full mt-2 flex items-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-left font-semibold text-sm cursor-pointer ${
                    currentTab === 'admin' 
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-l-4 border-amber-300 pl-3 shadow-md' 
                      : 'text-amber-200/80 hover:bg-amber-500/20 hover:text-amber-100'
                  }`}
                >
                  <ShieldCheck className="w-[21px] h-[21px] shrink-0" />
                  <span className="leading-tight">การจัดการสิทธิ์</span>
                </button>
              )}

            </nav>
          </div>

          {/* Sidebar Footer - Logout Button */}
          <div className="p-4 bg-[#041224] border-t border-pwa-blue/20">
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl transition duration-200 text-center font-bold text-sm cursor-pointer text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300 shadow-sm border border-red-500/20 active:scale-95"
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-pwa-blue-dark via-[#004B8C] to-pwa-blue text-white border-b border-pwa-cyan/20 px-8 py-2 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 hover:bg-pwa-blue/30 rounded-lg transition duration-150 text-white cursor-pointer shadow-sm border border-pwa-blue/40 flex items-center justify-center bg-pwa-blue-dark/50 active:scale-95 animate-fadeIn"
                title="แสดงเมนูแถบข้าง"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-3 pl-1">
              <img 
                src="https://www.sakhononline.com/news/2017/wp-content/uploads/2017/12/กปภ.-LOGO.jpg" 
                alt="PWA Logo" 
                className="w-9 h-9 rounded-full object-cover shadow-lg border-2 border-white"
              />
              <div className="flex flex-col">
                <h1 className="text-lg font-extrabold text-white font-display tracking-wide drop-shadow-md">
                  ระบบติดตามข้อมูลโครงการขยายเขต กปภ.ข.6
                </h1>
                <p className="text-[10px] text-blue-200/90 font-medium tracking-wider">PROVINCIAL WATERWORKS AUTHORITY REGION 6</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User Profile in Header */}
            <div className="flex items-center gap-3 bg-pwa-blue-dark/40 px-4 py-2 rounded-xl border border-white/10">
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-white leading-tight font-display">
                  {user?.firstname ? `${user.firstname} ${user.lastname || ''}` : (user?.local_username || user?.pwa_username)}
                </span>
                <span className="text-[10px] text-pwa-cyan font-medium leading-tight mt-0.5">
                  สิทธิ์: {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : (user?.role?.toLowerCase() === 'planning' ? 'ผู้ใช้งานระดับ Planning' : 'ผู้ใช้งาน')}
                </span>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pwa-cyan to-blue-500 flex items-center justify-center text-white font-bold shadow-md border border-white/20 shrink-0">
                {(user?.firstname?.[0] || user?.local_username?.[0] || user?.pwa_username?.[0] || '?').toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Prominent Page Title */}
        {currentTab !== 'admin' && (
          <div className="bg-white/40 border-b border-slate-200/60 py-2.5 px-8 shadow-sm shrink-0">
            {currentTab === 'projects' && (
              <h2 className="text-lg font-extrabold text-[#004B8C] font-display flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-100/50 rounded-md">
                  <Briefcase className="w-5 h-5 text-[#004B8C] drop-shadow-sm" />
                </div>
                รายงานข้อมูลผลการเพิ่มขยายเขตจำหน่ายน้ำ รายโครงการ
              </h2>
            )}
            {currentTab === 'monthly' && (
              <h2 className="text-lg font-extrabold text-[#004B8C] font-display flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-100/50 rounded-md">
                  <BarChart3 className="w-5 h-5 text-[#004B8C] drop-shadow-sm" />
                </div>
                สถิติจำนวนผู้ใช้น้ำที่เกิดขึ้นจริง รายกปภ.สาขา รายเดือน
              </h2>
            )}
            {currentTab === 'breakeven' && (
              <h2 className="text-lg font-extrabold text-[#004B8C] font-display flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-100/50 rounded-md">
                  <PieChart className="w-5 h-5 text-[#004B8C] drop-shadow-sm" />
                </div>
                แดชบอร์ดประเมินจำนวนผู้ใช้น้ำตามเป้าหมายโครงการสะสม
              </h2>
            )}
            {currentTab === 'water-usage' && (
              <h2 className="text-lg font-extrabold text-[#004B8C] font-display flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-100/50 rounded-md">
                  <Droplets className="w-5 h-5 text-[#004B8C] drop-shadow-sm" />
                </div>
                วิเคราะห์และประเมินปริมาณการใช้น้ำสะสมของโครงการ
              </h2>
            )}
          </div>
        )}

        {/* Filter Bar */}
        {currentTab !== 'admin' && (
          <div className="bg-pwa-blue-light/30 border-b border-pwa-blue-light/80 px-8 py-4 flex flex-wrap gap-4 items-center shrink-0">
            {/* Year Filter */}
          <div className="flex flex-col gap-1 w-44">
            <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">
              {(currentTab === 'monthly' || currentTab === 'water-usage') ? 'ปีงบประมาณ' : 'โครงการประจำปีงบประมาณ'}
            </label>
            <select 
              value={filterYear}
              onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }}
              className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
            >
              <option value="all">ปีงบประมาณทั้งหมด</option>
              {FISCAL_YEARS.map(y => <option key={y} value={y}>พ.ศ. {y}</option>)}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="flex flex-col gap-1 w-48">
            <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">กปภ.สาขา</label>
            <select 
              value={filterBranch}
              onChange={(e) => { setFilterBranch(e.target.value); setCurrentPage(1); }}
              className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
            >
              <option value="all">ทุกสาขา ในสังกัด เขต 6</option>
              {branches.map(b => <option key={b.id} value={b.branch_name}>กปภ.สาขา{b.branch_name}</option>)}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1 w-64">
            <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">ประเภทโครงการขยายเขต</label>
            <select 
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
              className="border border-pwa-blue/20 text-sm rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm cursor-pointer"
            >
              <option value="all">ประเภทโครงการทั้งหมด</option>
              {Object.entries(PROJECT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-[11px] font-extrabold text-pwa-blue-dark/85 uppercase tracking-wider">ค้นหาโครงการ</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  placeholder="ค้นหาด้วยรหัส, สัญญา, สาขา หรือชื่อโครงการ..."
                  className="w-full border border-pwa-blue/20 text-sm rounded-lg pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue/20 font-semibold text-slate-700 shadow-sm"
                />
                <Search className="w-4 h-4 text-pwa-blue absolute left-3 top-2.5" />
              </div>
              {currentTab === 'projects' && user?.role !== 'user' && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 text-xs text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 font-bold px-4 py-2 rounded-lg transition duration-150 shadow-md active:scale-95 cursor-pointer whitespace-nowrap border border-emerald-400/20"
              >
                <Briefcase className="w-3.5 h-3.5" />
                + เพิ่มโครงการใหม่
              </button>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Content Body */}
        <div className="p-8 space-y-8 flex-1">
          
          {/* --- TAB 1: PROJECTS OVERVIEW --- */}
          {currentTab === 'projects' && (
            <div className="space-y-8 animate-fadeIn">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fadeIn">
                <div className="glass-card p-6 rounded-2xl border-t-4 border-pwa-blue flex items-center justify-between transition-all-custom">
                  <div>
                    <span className="text-xs text-slate-500 font-bold block mb-1">จำนวนโครงการขยายเขต</span>
                    <span className="text-2xl font-black font-display text-pwa-blue-dark">{kpis.count} โครงการ</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-pwa-blue-light/60 flex items-center justify-center text-pwa-blue-dark shadow-inner">
                    <Layers className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass-card p-6 rounded-2xl border-t-4 border-emerald-500 flex items-center justify-between transition-all-custom">
                  <div>
                    <span className="text-xs text-slate-500 font-bold block mb-1">วงเงินงบประมาณรวม</span>
                    <span className="text-2xl font-black font-display text-emerald-800">{kpis.totalBudget} <span className="text-xs font-bold text-slate-400">บาท</span></span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass-card p-6 rounded-2xl border-t-4 border-pwa-cyan flex items-center justify-between transition-all-custom">
                  <div>
                    <span className="text-xs text-slate-500 font-bold block mb-1">เป้าหมายผู้ใช้บริการรวม</span>
                    <span className="text-2xl font-black font-display text-pwa-blue-dark">{kpis.totalTarget} <span className="text-xs font-bold text-slate-400">ราย</span></span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-pwa-cyan-light flex items-center justify-center text-pwa-cyan shadow-inner">
                    <Users className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass-card p-6 rounded-2xl border-t-4 border-pwa-gold flex items-center justify-between transition-all-custom">
                  <div>
                    <span className="text-xs text-slate-500 font-bold block mb-1">ผู้ใช้จริงสะสม (% บรรลุผล)</span>
                    <span className="text-2xl font-black font-display text-pwa-blue-dark">
                      {kpis.totalActual} <span className="text-xs font-bold text-slate-400">ราย</span>{' '}
                      <span className="text-sm font-black text-emerald-600">({kpis.overallAchievement}%)</span>
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-pwa-gold-light flex items-center justify-center text-pwa-gold shadow-inner">
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
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <BarChart data={branchChartData} margin={{ top: 10, right: 5, left: -15, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4EEF8" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Sarabun' }} angle={-45} textAnchor="end" height={70} interval={0} />
                        <YAxis width={60} tickFormatter={(val) => val.toLocaleString()} tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <Tooltip formatter={(value) => value.toLocaleString()} contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                        <Bar dataKey="เป้าหมาย" fill="#003B73" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ผลงานจริง" fill="#00A9E0" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Type breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 font-display">จำนวนผู้ใช้น้ำเป้าหมายเทียบกับผลงานที่เกิดจริง แยกตามประเภทงบประมาณโครงการ (ราย)</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <BarChart data={typeChartData} margin={{ top: 10, right: 5, left: -15, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4EEF8" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <YAxis width={60} tickFormatter={(val) => val.toLocaleString()} tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <Tooltip formatter={(value) => value.toLocaleString()} contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                        <Bar dataKey="เป้าหมาย" fill="#003B73" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ผลงานจริง" fill="#00A9E0" radius={[4, 4, 0, 0]} />
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
              <div className="bg-white rounded-2xl border border-blue-100 shadow-md overflow-hidden">
                <div className="px-8 py-5 border-b border-blue-100 bg-blue-50/30 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-extrabold text-[#0B2545] font-display text-base">ตารางรายละเอียดโครงการและการบรรลุผลสำเร็จ</h3>
                    <p className="text-xs text-blue-900/70 font-semibold">แสดงผลรวมผู้ใช้น้ำจริงเทียบกับเป้าหมายสะสม ค้นหาและคัดกรองได้อิสระ</p>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Local Search Input like DataTable */}
                    <div className="relative w-64">
                      <input 
                        type="text" 
                        value={tableSearchTerm}
                        onChange={(e) => { setTableSearchTerm(e.target.value); setCurrentPage(1); }}
                        placeholder="ค้นหาข้อมูลโครงการในตาราง..."
                        className="w-full border border-blue-200 text-xs rounded-xl pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-700 shadow-sm"
                      />
                      <Search className="w-3.5 h-3.5 text-blue-500 absolute left-3 top-2.5" />
                    </div>

                    <button 
                      onClick={handleExportCSV}
                      className="flex items-center gap-2 bg-blue-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-blue-700 transition duration-155 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      ส่งออกข้อมูลเป็น CSV (Excel)
                    </button>
                    {user?.role !== 'user' && (
                    <button 
                      onClick={() => setIsAddModalOpen(true)}
                      className="flex items-center gap-2 bg-emerald-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition duration-155 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Briefcase className="w-4 h-4" />
                      เพิ่มโครงการใหม่
                    </button>
                    )}
                  </div>
                </div>

                {/* Table element */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-pwa-blue-light/60 text-[13px] font-bold text-pwa-blue-dark border-b border-pwa-blue/15 uppercase tracking-wider">
                        <th onClick={() => handleSort('project_code')} className="px-6 py-4 cursor-pointer hover:bg-pwa-blue/10 hover:text-pwa-blue transition whitespace-nowrap text-pwa-blue-dark">รหัสโครงการ ⇅</th>
                        <th className="px-6 py-4 text-pwa-blue-dark">เลขที่สัญญา</th>
                        <th onClick={() => handleSort('branch_name')} className="px-6 py-4 cursor-pointer hover:bg-pwa-blue/10 hover:text-pwa-blue transition whitespace-nowrap text-pwa-blue-dark">กปภ.สาขา ⇅</th>
                        <th className="px-6 py-4 text-pwa-blue-dark">ชื่อโครงการ</th>
                        <th onClick={() => handleSort('completion_year')} className="px-6 py-4 cursor-pointer hover:bg-pwa-blue/10 hover:text-pwa-blue transition whitespace-nowrap text-center text-pwa-blue-dark">ปีแล้วเสร็จ ⇅</th>
                        <th onClick={() => handleSort('budget')} className="px-6 py-4 text-right cursor-pointer hover:bg-pwa-blue/10 hover:text-pwa-blue transition whitespace-nowrap text-pwa-blue-dark">วงเงิน (บาท) ⇅</th>
                        <th className="px-6 py-4 text-pwa-blue-dark">ประเภทโครงการ</th>
                        <th className="px-6 py-4 text-right text-pwa-blue-dark">เป้าหมาย (ราย)</th>
                        <th className="px-6 py-4 text-right text-pwa-blue-dark">เกิดจริงสะสม (ราย)</th>
                        <th className="px-6 py-4 text-center text-pwa-blue-dark">% ความสำเร็จ</th>
                        <th className="px-6 py-4 text-center text-pwa-blue-dark">แผนที่</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {paginatedProjects.length > 0 ? (
                        paginatedProjects.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 font-bold text-slate-800 font-display">{p.project_code}</td>
                             <td className="px-6 py-4 text-sm text-blue-600 whitespace-nowrap font-extrabold font-mono">
                               {p.contract_no ? (
                                 <span 
                                   onClick={() => user?.role !== 'user' && handleOpenEditContractModal(p)}
                                   className={user?.role !== 'user' ? "hover:underline cursor-pointer hover:text-blue-800 transition" : ""}
                                   title={user?.role !== 'user' ? "คลิกเพื่อแก้ไขเลขที่สัญญาหรือวันที่เสร็จสิ้นโครงการ" : "เลขที่สัญญา"}
                                 >
                                   {p.contract_no}
                                 </span>
                               ) : (
                                 user?.role !== 'user' ? (
                                   <button
                                     onClick={() => handleOpenEditContractModal(p)}
                                     className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-all text-[11px] font-bold shadow-sm border border-blue-200 hover:border-blue-300 active:scale-95 cursor-pointer"
                                     title="คลิกเพื่อกรอกเลขที่สัญญาโครงการ"
                                   >
                                     <Edit3 className="w-3.5 h-3.5" />
                                     กรอกเลขที่สัญญา
                                   </button>
                                 ) : (
                                   <span className="text-slate-400 italic font-normal text-xs">ไม่มีข้อมูล</span>
                                 )
                               )}
                             </td>
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
                            <td className="px-6 py-4 text-right font-extrabold text-slate-800">{parseInt(p.target_users || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-extrabold text-rose-500">
                              {parseInt(p.total_actual_users) > 0 ? (
                                <button
                                  onClick={() => handleOpenCustomerModal(p)}
                                  className="hover:text-rose-700 underline underline-offset-2 hover:scale-105 transition cursor-pointer font-extrabold"
                                  title="คลิกเพื่อดูรายชื่อผู้ใช้น้ำ"
                                >
                                  {parseInt(p.total_actual_users).toLocaleString()}
                                </button>
                              ) : (
                                <span>0</span>
                              )}
                            </td>
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
                <div className="bg-gradient-to-tr from-blue-900 to-blue-800 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between">
                  <div>
                    <span className="text-xs text-blue-300 uppercase tracking-widest block mb-2 font-bold font-display">สรุปความสำเร็จรายเดือน</span>
                    <h4 className="text-lg font-bold font-display leading-snug mb-3">เปรียบเทียบสถิติยอดผู้ใช้น้ำรายสาขาแยกรายเดือน</h4>
                    <p className="text-xs text-blue-100/80 font-light leading-relaxed">
                      ปีงบประมาณของ กปภ.ข.6 จะเริ่มต้นตั้งแต่เดือน ตุลาคม ไปสิ้นสุดในเดือน กันยายน ของปีถัดไป การตรวจสอบแบบ Matrix Grid จะช่วยให้เห็นว่าสาขาใดมียอดผู้ใช้ขยายเขตบรรลุเป้าหมายสูงสุดในแต่ละช่วงฤดูกาล
                    </p>
                  </div>
                  <div className="pt-6 border-t border-blue-800 text-xs text-blue-200/80 leading-relaxed">
                    💡 <span className="font-bold text-white">คำแนะนำ:</span> ท่านสามารถคลิกที่ตัวเลขของสาขาในตาราง Matrix Grid ด้านล่าง เพื่อเจาะลึกดูรายการโครงการย่อยทั้งหมดที่เกิดขึ้นในจุดนั้นได้ทันที!
                  </div>
                </div>

                {/* Chart 3: Trend Line */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 font-display">แนวโน้มจำแนกตามเดือน (ผลงานผู้ใช้เกิดขึ้นจริงรายเดือนปีที่เลือก)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={monthlyTrendData} margin={{ top: 10, right: 5, left: -15, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4EEF8" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Sarabun' }} angle={-30} textAnchor="end" height={45} interval={0} />
                        <YAxis width={60} tickFormatter={(val) => val.toLocaleString()} tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                        <Tooltip formatter={(value) => value.toLocaleString()} contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                        <Line type="monotone" dataKey="ผู้ใช้จริง" stroke="#0056B3" strokeWidth={3} activeDot={{ r: 8 }} dot={{ fill: '#00A9E0', stroke: '#0056B3', strokeWidth: 2 }} />
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
                      <tr className="bg-pwa-blue-dark border-b border-pwa-blue-dark text-xs text-white font-bold uppercase">
                        <th className="px-6 py-4 bg-pwa-blue-dark/95 font-bold font-display whitespace-nowrap text-white">กปภ.สาขา (เขต 6)</th>
                        {MONTHS_TH.map(m => (
                          <th key={m.num} className="px-4 py-4 text-center font-bold text-[11px] whitespace-nowrap text-blue-100">{m.name}</th>
                        ))}
                        <th className="px-6 py-4 text-right bg-pwa-blue-dark font-bold text-white whitespace-nowrap">ผลงานรวมจริง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {branches
                        .filter(branch => filterBranch === 'all' || branch.branch_name === filterBranch)
                        .map(branch => {
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
                                let textClass = 'text-slate-400 font-normal';
                                if (actualVal > 25) {
                                  bgClass = 'bg-pwa-blue';
                                  textClass = 'text-white font-extrabold';
                                } else if (actualVal > 15) {
                                  bgClass = 'bg-pwa-cyan/25';
                                  textClass = 'text-pwa-blue-dark font-bold';
                                } else if (actualVal > 5) {
                                  bgClass = 'bg-pwa-cyan-light';
                                  textClass = 'text-pwa-cyan font-bold';
                                } else if (actualVal > 0) {
                                  bgClass = 'bg-[#F8FBFE]';
                                  textClass = 'text-slate-650 font-semibold';
                                }

                                return (
                                  <td 
                                    key={m.num} 
                                    onClick={() => {
                                      setSelectedBranchDrill(branch.branch_name);
                                      setSelectedMonthDrill(m.num);
                                      setSelectedYearDrill(filterYear === 'all' ? 2569 : parseInt(filterYear));
                                    }}
                                    className={`px-4 py-4 text-center cursor-pointer transition duration-150 border-r border-slate-100/50 hover:bg-pwa-blue-light ${bgClass} ${textClass}`}
                                    title="คลิกเจาะลึกดูความเคลื่อนไหวรายโครงการ"
                                  >
                                    {actualVal.toLocaleString()}
                                  </td>
                                );
                              })}
                              <td className="px-6 py-4 text-right font-display font-bold text-pwa-blue bg-pwa-blue-light/50 border-l border-slate-100 whitespace-nowrap">
                                {branchTotal.toLocaleString()} ราย
                              </td>
                            </tr>
                          );
                        })}
                      {(() => {
                        const displayedBranches = branches.filter(branch => filterBranch === 'all' || branch.branch_name === filterBranch);
                        if (displayedBranches.length === 0) return null;
                        
                        let grandTotal = 0;
                        const monthlyTotals = MONTHS_TH.map(m => {
                          const monthSum = displayedBranches.reduce((sum, branch) => {
                            return sum + (monthlyBranchGrid[branch.branch_name]?.[m.num] || 0);
                          }, 0);
                          grandTotal += monthSum;
                          return { num: m.num, sum: monthSum };
                        });

                        return (
                          <tr className="bg-slate-100/80 hover:bg-slate-200/50 font-bold text-slate-800 border-t-2 border-slate-200">
                            <td className="px-6 py-4 font-bold text-slate-900 bg-slate-100 border-r border-slate-200 whitespace-nowrap">
                              ผลรวมทั้งหมด
                            </td>
                            {monthlyTotals.map(mt => (
                              <td 
                                key={mt.num} 
                                className="px-4 py-4 text-center border-r border-slate-200 text-pwa-blue-dark font-extrabold"
                              >
                                {mt.sum.toLocaleString()}
                              </td>
                            ))}
                            <td className="px-6 py-4 text-right font-display font-extrabold text-pwa-blue bg-pwa-blue-light border-l border-slate-200 whitespace-nowrap">
                              {grandTotal.toLocaleString()} ราย
                            </td>
                          </tr>
                        );
                      })()}
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
                        <h4 className="font-bold text-slate-800 font-display">รายละเอียดข้อมูลรายโครงการ</h4>
                        <p className="text-xs text-slate-500 font-light">
                          กปภ.สาขา{selectedBranchDrill} ประจำเดือน <span className="font-bold text-blue-600">{MONTHS_TH.find(m => m.num === selectedMonthDrill)?.name}</span> ปีงบประมาณ <span className="font-bold text-blue-600">{filterYear === 'all' ? 'ทั้งหมด' : `พ.ศ. ${selectedYearDrill}`}</span>
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
                        <div 
                          key={idx} 
                          onClick={() => handleOpenCustomerModal(p)}
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-500 hover:shadow-md transition duration-150 active:scale-98 cursor-pointer group"
                          title="คลิกเพื่อดูรายชื่อผู้ใช้น้ำของโครงการนี้"
                        >
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block tracking-wider">{p.project_code} • พ.ศ. {p.fiscal_year} • {PROJECT_TYPES_SHORT[p.project_type]}</span>
                            <h5 className="text-xs font-bold text-slate-700 mt-1 line-clamp-1 group-hover:text-blue-600 transition">{p.project_name}</h5>
                            <span className="text-[9px] text-blue-500/80 font-bold mt-1.5 inline-flex items-center gap-0.5">
                              🔍 คลิกดูรายชื่อผู้ใช้น้ำ
                            </span>
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
                          <span className="text-3xl font-extrabold text-slate-800 font-display">{stats.breakevenCount.toLocaleString()}</span>
                          <span className="text-xs text-slate-400 font-medium">จาก {stats.count.toLocaleString()} โครงการคุ้มทุนแล้ว</span>
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
                    <h3 className="font-bold text-slate-800 font-display text-lg">เครื่องมือประเมินจำนวนผู้ใช้น้ำตามเป้าหมายโครงการสะสมรายปี (Project Deep-Dive Payback Analyzer)</h3>
                    <p className="text-xs text-slate-500 font-light">เลือกโครงการขยายเขตผู้ใช้น้ำที่ต้องการ เพื่อดึงเส้นเป้าหมายตามเกณฑ์ 5 ปี สะสมเปรียบเทียบผลลัพธ์จริง</p>
                  </div>
                  
                  {/* Project Search Selector */}
                  <div className="w-96 flex flex-col gap-1">
                    <label className="text-[10px] font-extrabold text-slate-400 tracking-wider">เลือกโครงการที่ต้องการประเมินจำนวนผู้ใช้น้ำตามเป้าหมายโครงการ</label>
                    <select 
                      value={selectedProjectId || ''}
                      onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : null)}
                      className="border-2 border-blue-600/30 text-sm font-bold rounded-xl px-4 py-2.5 bg-blue-50/20 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer w-full"
                      disabled={sortedBreakevenProjects.length === 0}
                    >
                      {sortedBreakevenProjects.length > 0 ? (
                        sortedBreakevenProjects.map(p => {
                          const rate = parseFloat(p.achievement_rate || 0);
                          const color = rate >= 100 ? '#059669' : rate >= 70 ? '#d97706' : '#dc2626';
                          return (
                            <option key={p.id} value={p.id} style={{ color, fontWeight: 'bold' }}>
                              ● [{p.project_code}] ({p.achievement_rate}%) - {p.project_name.substring(0, 50)}...
                            </option>
                          );
                        })
                      ) : (
                        <option value="">-- ไม่พบโครงการตามตัวกรอง --</option>
                      )}
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
                            <tr className="py-2.5 flex justify-between"><td className="text-slate-400 font-medium">เป้าหมายผู้ใช้น้ำ</td><td className="font-bold text-slate-800">{parseInt(projectDeepDive.target_users || 0).toLocaleString()} ราย</td></tr>
                            <tr className="py-2.5 flex justify-between"><td className="text-slate-400 font-medium">เกิดจริงสะสมขณะนี้</td><td className="font-bold text-rose-600">{parseInt(projectDeepDive.total_actual_users || 0).toLocaleString()} ราย</td></tr>
                            <tr className="py-2.5 flex justify-between"><td className="text-slate-400 font-medium">เกณฑ์การประเมินจำนวนผู้ใช้น้ำตามเป้าหมายโครงการ</td><td className="font-bold text-blue-600">{projectDeepDive.project_type === 4 ? 'ประเมิน 1 ปีที่แล้วเสร็จ' : 'ประเมินสะสม 5 ปี'}</td></tr>
                          </tbody>
                        </table>

                        {/* Status Badge */}
                        <div className="mt-6">
                          {parseInt(projectDeepDive.total_actual_users || 0) >= parseInt(projectDeepDive.target_users) ? (
                            <div className="w-full bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl font-extrabold text-center text-sm shadow-sm flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              บรรลุจำนวนผู้ใช้น้ำตามเป้าหมายโครงการ ({projectDeepDive.achievement_rate}%)
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
                      <div className="p-4 bg-blue-50/50 border border-blue-100 text-slate-600 rounded-xl text-xs space-y-2 leading-relaxed">
                        <span className="font-bold text-blue-800 block font-display">📌 เกณฑ์การประเมินจำนวนผู้ใช้น้ำตามเป้าหมายโครงการ กปภ.ข.6:</span>
                        {projectDeepDive.project_type === 4 ? (
                          <p>เนื่องจากเป็น <strong className="text-slate-850">"โครงการวางท่อเข้าซอย"</strong> จะคิดคุ้มทุนเพียง 1 ปี คือในปีงบประมาณที่แล้วเสร็จเป็นหลัก โดยผลงานจริงสะสมต้องบรรลุเป้าหมายที่ตั้งไว้ (100%) ทันที</p>
                        ) : (
                          <p>เนื่องจากเป็น <strong className="text-slate-850">"โครงการจำหน่ายน้ำ"</strong> จะใช้เกณฑ์ประเมินผลการขยายเขตสะสมเป็นระยะเวลา 5 ปี โดยมีสัดส่วนเป้าหมายของปีที่ 1 เท่ากับ 40% (รวมยอดผู้ใช้น้ำจริงตั้งแต่ปีที่เริ่มดำเนินการแล้วเสร็จ) และปีที่ 2 ถึง 5 คิดเป็นปีละ 15% ตามลำดับ</p>
                        )}
                      </div>
                    </div>

                    {/* Chart and Milestone Timeline Grid */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Live Payback Chart */}
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
                        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3">กราฟวิเคราะห์แนวโน้มจำนวนผู้ใช้น้ำตามเป้าหมายโครงการสะสม (Cumulative Targets vs Actual)</h4>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <LineChart data={breakEvenData.chartData} margin={{ top: 10, right: 5, left: -15, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E4EEF8" />
                              <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Sarabun' }} angle={-30} textAnchor="end" height={45} interval={0} />
                              <YAxis width={60} tickFormatter={(val) => val.toLocaleString()} tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                              <Tooltip formatter={(value) => value.toLocaleString()} contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                              <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                              <Line type="monotone" dataKey="เป้าหมายสะสม" stroke="#003B73" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
                              <Line type="monotone" dataKey="ผลงานจริงสะสม" stroke="#00A9E0" strokeWidth={4} activeDot={{ r: 8 }} dot={{ fill: '#00A9E0', r: 5 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Milestone Timeline cards */}
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3 font-display">ไทม์ไลน์บันทึกเป้าหมายการขยายเขตรายปี</h4>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                          {breakEvenData.timeline.map((yr, idx) => (
                            <div key={idx} className={`p-3 rounded-xl border transition-all duration-200 shadow-sm ${
                              yr.success 
                                ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300' 
                                : 'bg-white border-slate-200 hover:border-blue-300'
                            }`}>
                              <span className="text-[10px] font-extrabold text-slate-400 block tracking-tight line-clamp-1">{yr.label}</span>
                              <span className="text-xs font-bold text-blue-900 block mt-1">สัดส่วน: {yr.alloc}%</span>
                              
                              <div className="mt-3 space-y-1 text-[11px] leading-tight">
                                <div className="flex justify-between"><span className="text-slate-400 font-medium">เป้าปีนี้:</span><span className="font-bold text-slate-700">{parseInt(yr.target || 0).toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400 font-medium">เกิดจริงปีนี้:</span><span className="font-bold text-slate-700">{parseInt(yr.actual || 0).toLocaleString()}</span></div>
                                <hr className="my-1 border-slate-100" />
                                <div className="flex justify-between"><span className="text-slate-500 font-bold">เป้าสะสม:</span><span className="font-extrabold text-slate-800">{parseInt(yr.cumTarget || 0).toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500 font-bold">จริงสะสม:</span><span className={`font-extrabold ${yr.success ? 'text-emerald-700' : 'text-rose-500'}`}>{parseInt(yr.cumActual || 0).toLocaleString()}</span></div>
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

                {!projectDeepDive && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 shadow-inner">
                    <AlertTriangle className="w-12 h-12 text-slate-300 animate-pulse mb-3" />
                    <p className="text-sm font-bold text-slate-650 font-display">ไม่พบโครงการตามตัวกรองที่เลือก</p>
                    <p className="text-xs text-slate-450 mt-1">กรุณาปรับเปลี่ยนค่าในแถบตัวกรองหลักที่ด้านบนของระบบ</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- TAB 3.5: WATER USAGE EVALUATION --- */}
          {currentTab === 'water-usage' && (
            <div className="space-y-8 animate-fadeIn">
              {waterUsageLoading ? (
                <div className="flex flex-col items-center justify-center py-40 text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <RefreshCw className="w-12 h-12 text-[#004B8C] animate-spin mb-4" />
                  <p className="text-sm font-bold animate-pulse font-display text-[#004B8C]">กำลังดึงข้อมูลวิเคราะห์การใช้น้ำสะสมของโครงการ...</p>
                </div>
              ) : waterUsageData ? (
                <>
                  {/* Summary Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
                      <div>
                        <span className="text-xs text-slate-500 font-bold block mb-1">ผู้ใช้น้ำทั้งหมด</span>
                        <span className="text-2xl font-black font-display text-pwa-blue-dark">
                          {waterUsageData.metrics.total_users.toLocaleString()} <span className="text-xs font-bold text-slate-400">ราย</span>
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                        <Users className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
                      <div>
                        <span className="text-xs text-slate-500 font-bold block mb-1">จำนวนบิลทั้งหมด</span>
                        <span className="text-2xl font-black font-display text-pwa-blue-dark">
                          {waterUsageData.metrics.total_bills.toLocaleString()} <span className="text-xs font-bold text-slate-400">บิล</span>
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600 shadow-inner">
                        <Database className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
                      <div>
                        <span className="text-xs text-slate-500 font-bold block mb-1">ปริมาณใช้น้ำสะสม</span>
                        <span className="text-2xl font-black font-display text-pwa-blue-dark">
                          {waterUsageData.metrics.total_usage.toLocaleString()} <span className="text-xs font-bold text-slate-400">ลบ.ม.</span>
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                        <Droplets className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
                      <div>
                        <span className="text-xs text-slate-500 font-bold block mb-1">รายได้ค่าน้ำสะสม</span>
                        <span className="text-2xl font-black font-display text-pwa-blue-dark">
                          {waterUsageData.metrics.total_amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs font-bold text-slate-400">บาท</span>
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
                        <DollarSign className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  {/* Trend & Branch Breakdown Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Monthly or Yearly Trend Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-700 mb-4 font-display">
                        {filterYear === 'all' 
                          ? 'แนวโน้มปริมาณการใช้น้ำและรายได้สะสม รายปี' 
                          : 'แนวโน้มปริมาณการใช้น้ำและรายได้สะสม รายเดือน'}
                      </h3>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <BarChart 
                            data={filterYear === 'all' 
                              ? [...(waterUsageData.yearly || [])].reverse().map(y => ({ ...y, displayName: `พ.ศ. ${y.fiscal_year}` }))
                              : waterUsageData.monthly} 
                            margin={{ top: 10, right: -15, left: -15, bottom: 25 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E4EEF8" />
                            <XAxis dataKey={filterYear === 'all' ? 'displayName' : 'month_name'} tick={{ fontSize: 10, fontFamily: 'Sarabun' }} angle={-30} textAnchor="end" height={45} interval={0} />
                            <YAxis yAxisId="left" orientation="left" stroke="#003B73" width={60} tickFormatter={(val) => (val / 1000000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[.,]000$/, '')} tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#10B981" width={60} tickFormatter={(val) => (val / 1000000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[.,]000$/, '')} tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                            <Tooltip formatter={(value, name) => [ (value / 1000000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[.,]000$/, '') + ' ' + (name.includes('น้ำ') ? 'ล้าน ลบ.ม.' : 'ล้านบาท'), name ]} contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                            <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                            <Bar yAxisId="left" dataKey="total_usage" name="ปริมาณน้ำสะสม (ล้าน ลบ.ม.)" fill="#003B73" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="right" dataKey="total_amount" name="รายได้สะสม (ล้านบาท)" fill="#10B981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Branch Breakdown Chart */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-700 mb-4 font-display">ปริมาณน้ำสะสม แยกตาม กปภ.สาขา (ล้าน ลบ.ม.)</h3>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <BarChart data={waterUsageData.branches} margin={{ top: 10, right: 5, left: -15, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E4EEF8" />
                            <XAxis dataKey="branch_name" tick={{ fontSize: 10, fontFamily: 'Sarabun' }} angle={-45} textAnchor="end" height={70} interval={0} />
                            <YAxis width={60} tickFormatter={(val) => (val / 1000000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[.,]000$/, '')} tick={{ fontSize: 11, fontFamily: 'Sarabun' }} />
                            <Tooltip formatter={(value) => (value / 1000000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[.,]000$/, '') + ' ล้าน ลบ.ม.'} contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8 }} />
                            <Legend wrapperStyle={{ fontFamily: 'Sarabun', fontSize: 12 }} />
                            <Bar dataKey="total_usage" name="ปริมาณน้ำสะสม (ล้าน ลบ.ม.)" fill="#00A9E0" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Datatable */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-8 py-5 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-5 h-5 text-blue-600" />
                        <div>
                          <h3 className="font-bold text-slate-800 font-display">ตารางวิเคราะห์ผลการใช้น้ำสะสมรายโครงการ</h3>
                          <p className="text-xs text-slate-500 font-light">แสดงปริมาณน้ำสะสมและรายได้สะสมของโครงการขยายเขต (ค้นหาและคลิกเพื่อดูรายละเอียดผู้ใช้น้ำ)</p>
                        </div>
                      </div>
                      
                      {/* Search Bar for local search */}
                      <div className="relative w-80">
                        <input 
                          type="text" 
                          value={waterUsageTableSearch}
                          onChange={(e) => { setWaterUsageTableSearch(e.target.value); setWaterUsageCurrentPage(1); }}
                          placeholder="ค้นหารหัส, สัญญา, สาขา หรือชื่อโครงการ..."
                          className="w-full border border-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-pwa-blue-light/60 text-[13px] font-bold text-pwa-blue-dark border-b border-pwa-blue/15 uppercase tracking-wider">
                            <th className="px-6 py-4 text-pwa-blue-dark whitespace-nowrap">รหัสโครงการ</th>
                            <th className="px-6 py-4 text-pwa-blue-dark whitespace-nowrap">เลขที่สัญญา</th>
                            <th className="px-6 py-4 text-pwa-blue-dark whitespace-nowrap">กปภ.สาขา</th>
                            <th className="px-6 py-4 text-pwa-blue-dark">ชื่อโครงการ</th>
                            <th className="px-6 py-4 text-right text-pwa-blue-dark whitespace-nowrap">ปริมาณน้ำสะสม (ลบ.ม.)</th>
                            <th className="px-6 py-4 text-right text-pwa-blue-dark whitespace-nowrap">รายได้สะสม (บาท)</th>
                            <th className="px-6 py-4 text-center text-pwa-blue-dark whitespace-nowrap">การกระทำ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {paginatedWaterUsageProjects.length > 0 ? (
                            paginatedWaterUsageProjects.map((p) => (
                              <tr key={p.project_code} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4 font-bold text-slate-800 font-display">{p.project_code}</td>
                                <td className="px-6 py-4 text-sm text-blue-600 font-extrabold font-mono whitespace-nowrap">
                                  {p.contract_no || <span className="text-slate-400 italic font-normal text-xs">ไม่มีข้อมูล</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 w-fit">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {p.branch_name}
                                  </span>
                                </td>
                                <td className="px-6 py-4 max-w-sm truncate text-xs font-semibold text-slate-700" title={p.project_name}>{p.project_name}</td>
                                <td className="px-6 py-4 text-right font-extrabold text-blue-600">{p.total_usage.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[.,]000$/, '')}</td>
                                <td className="px-6 py-4 text-right font-extrabold text-emerald-600">{p.total_amount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[.,]000$/, '')}</td>
                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                  <button
                                    onClick={() => handleOpenWaterUsageModal(p)}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-pwa-blue hover:bg-pwa-blue-dark text-white shadow-sm active:scale-95 transition cursor-pointer whitespace-nowrap"
                                    title="ดูรายละเอียดผู้ใช้น้ำรายโครงการ"
                                  >
                                    <Users className="w-3 h-3 text-white" />
                                    ดูรายชื่อผู้ใช้
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="7" className="px-6 py-12 text-center text-slate-400 italic">ไม่พบข้อมูลโครงการที่ตรงกับการค้นหา</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination for Datatable */}
                    {waterUsageTotalPages > 1 && (
                      <div className="px-8 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">แสดงผลหน้าที่ {waterUsageCurrentPage} จากทั้งหมด {waterUsageTotalPages} หน้า (แสดงหน้าละ 10 ราย | จำนวนโครงการที่พบ {filteredWaterUsageProjects.length.toLocaleString()} โครงการ)</span>
                        <div className="flex gap-2">
                          <button 
                            disabled={waterUsageCurrentPage === 1}
                            onClick={() => setWaterUsageCurrentPage(prev => Math.max(1, prev - 1))}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-50 font-bold active:scale-95 transition cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            ก่อนหน้า
                          </button>
                          <button 
                            disabled={waterUsageCurrentPage === waterUsageTotalPages}
                            onClick={() => setWaterUsageCurrentPage(prev => Math.min(waterUsageTotalPages, prev + 1))}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-50 font-bold active:scale-95 transition cursor-pointer"
                          >
                            ถัดไป
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 shadow-inner">
                  <AlertTriangle className="w-12 h-12 text-slate-300 animate-pulse mb-3" />
                  <p className="text-sm font-bold text-slate-650 font-display">ไม่สามารถแสดงข้อมูลการใช้น้ำสะสมได้</p>
                  <p className="text-xs text-slate-450 mt-1">กรุณาลองปรับเปลี่ยนตัวเลือกในแถบตัวกรองหลักด้านบน</p>
                </div>
              )}
            </div>
          )}

          {/* --- TAB 4: ADMIN MANAGEMENT --- */}
          {currentTab === 'admin' && user?.role === 'admin' && (
            <AdminManagement currentUser={user} />
          )}

        </div>
      </main>

      {/* --- CUSTOMER DETAILS MODAL --- */}
      {isCustomerModalOpen && selectedProjectForCustomers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200/80">
            
            {/* Modal Header */}
            <div className="px-8 py-5 bg-gradient-to-r from-pwa-blue-dark to-pwa-blue text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pwa-cyan-light/20 text-pwa-cyan flex items-center justify-center border border-pwa-cyan/35">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-cyan-400 uppercase tracking-wider">[{selectedProjectForCustomers.project_code}]</span>
                    <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-350 text-[10px] font-bold">
                      {PROJECT_TYPES_SHORT[selectedProjectForCustomers.project_type]}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold mt-0.5 leading-snug truncate max-w-2xl font-display text-slate-100" title={selectedProjectForCustomers.project_name}>
                    รายชื่อผู้ใช้น้ำ: {selectedProjectForCustomers.project_name}
                  </h3>
                </div>
              </div>
              
              <button 
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-450 hover:text-white hover:bg-slate-700/50 p-2 rounded-xl transition duration-150 active:scale-95 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Filter Bar */}
            <div className="px-8 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between shrink-0">
              <div className="relative w-80">
                <input 
                  type="text" 
                  value={modalCustomerSearch}
                  onChange={(e) => setModalCustomerSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, รหัส หรือที่อยู่ผู้ใช้น้ำ..."
                  className="w-full border border-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                />
                <Search className="w-4 h-4 text-slate-450 absolute left-3 top-2.5" />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">
                  {loadingModalCustomers ? 'กำลังค้นหา...' : `พบผู้ใช้น้ำ ${filteredModalCustomers.length.toLocaleString()} ราย`}
                </span>
                <button 
                  onClick={handleExportModalCustomersCSV}
                  disabled={filteredModalCustomers.length === 0}
                  className="flex items-center gap-1.5 bg-slate-900 text-white font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition duration-150 shadow-sm active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  ส่งออกรายชื่อเป็น CSV
                </button>
              </div>
            </div>

            {/* Modal Content / Table */}
            <div className="flex-1 overflow-y-auto p-8 min-h-0 bg-white">
              {loadingModalCustomers ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <RefreshCw className="w-10 h-10 text-teal-650 animate-spin mb-3" />
                  <p className="text-sm font-semibold animate-pulse font-display text-teal-800">กำลังโหลดรายชื่อผู้ใช้น้ำจากฐานข้อมูล...</p>
                </div>
              ) : filteredModalCustomers.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">รหัสผู้ใช้น้ำ</th>
                        <th className="px-4 py-3 font-semibold">ชื่อ-นามสกุล</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">เลขที่มาตร</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">วันที่เริ่มเป็นผู้ใช้น้ำ</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">ขนาดมาตร</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">ยี่ห้อมาตร</th>
                        <th className="px-4 py-3 font-semibold">ประเภทการใช้น้ำ</th>
                        <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">หน่วยน้ำสะสม (ลบ.ม.)</th>
                        <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">สถานะ</th>
                        <th className="px-4 py-3 font-semibold">ที่อยู่ผู้ใช้น้ำ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredModalCustomers.map((c) => (
                        <tr key={c.cus_code} className="hover:bg-teal-50/20 transition">
                          <td className="px-4 py-3.5 font-bold font-mono text-slate-800">{c.cus_code}</td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800 whitespace-nowrap">{c.fullName}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-650 whitespace-nowrap">{c.meter_no || '-'}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-650 whitespace-nowrap">{c.bgncustdt_formatted || '-'}</td>
                          <td className="px-4 py-3.5 text-center font-semibold">{c.sizeName ? `${c.sizeName} นิ้ว` : '-'}</td>
                          <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{c.brandName || '-'}</td>
                          <td className="px-4 py-3.5 text-slate-655 min-w-[120px] font-medium leading-tight">{c.use_Name || '-'}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-blue-600">{c.present_meter_count !== null ? c.present_meter_count.toLocaleString() : '0'}</td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                              c.status === 'T' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {c.status === 'T' ? 'ปกติ (Active)' : c.status || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-[11px] text-slate-550 leading-relaxed min-w-[200px]">{c.full_address || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                  <Search className="w-12 h-12 text-slate-300 animate-pulse mb-3" />
                  <p className="text-sm font-semibold text-slate-600">ไม่พบรายชื่อผู้ใช้น้ำที่ตรงกับการค้นหา</p>
                  <p className="text-xs text-slate-450 mt-1">กรุณาลองป้อนคำค้นอื่น ๆ ในกล่องค้นหาด้านบน</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-light">
                * ข้อมูลผู้ใช้น้ำเชื่อมโยงจากตาราง customer และ proj_cus ของระบบ PCIS
              </span>
              <button 
                onClick={() => setIsCustomerModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition duration-150 active:scale-97 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- EDIT CONTRACT MODAL --- */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200/80">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-pwa-blue-dark to-pwa-blue text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pwa-cyan-light/20 text-pwa-cyan flex items-center justify-center border border-pwa-cyan/35 animate-pulse">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">อัปเดตข้อมูล</span>
                  <h3 className="text-sm font-bold mt-0.5 leading-snug font-display text-slate-100">
                    กรอกเลขที่สัญญาโครงการ
                  </h3>
                </div>
              </div>
              
              <button 
                disabled={isUpdatingContract}
                onClick={() => setEditingProject(null)}
                className="text-slate-450 hover:text-white hover:bg-slate-700/50 p-2 rounded-xl transition duration-150 active:scale-95 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col gap-2">
                <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                  <span className="text-slate-500 font-medium">รหัสโครงการ</span>
                  <span className="font-bold text-slate-800 font-mono">{editingProject.project_code}</span>
                </div>
                <div className="flex flex-col gap-1 pb-1.5 border-b border-slate-200/50">
                  <span className="text-slate-500 font-medium">ชื่อโครงการ</span>
                  <span className="font-bold text-slate-800 leading-normal">{editingProject.project_name}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500 font-medium">กปภ.สาขา</span>
                    <span className="font-bold text-slate-800">กปภ.สาขา{editingProject.branch_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500 font-medium">ปีงบประมาณเริ่มต้น</span>
                    <span className="font-bold text-slate-800">พ.ศ. {editingProject.start_year}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500 font-medium">งบประมาณ</span>
                    <span className="font-bold text-slate-800">{parseFloat(editingProject.budget || 0).toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500 font-medium">เป้าหมายผู้ใช้น้ำ</span>
                    <span className="font-bold text-slate-800">{editingProject.target_users} ราย</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-slate-500 font-medium">ประเภทโครงการ</span>
                    <span className="font-bold text-slate-800 text-right line-clamp-1">{PROJECT_TYPES[editingProject.project_type]}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-slate-650 font-bold">เลขที่สัญญา</label>
                <input 
                  type="text" 
                  value={newContractNo}
                  onChange={(e) => setNewContractNo(e.target.value)}
                  placeholder="เช่น กปภ.ข.6/34/2564 หรือ กปภ.ข.6/241/2568"
                  className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition"
                  disabled={isUpdatingContract}
                  autoFocus
                />
              </div>

              {/* วันที่เสร็จสิ้นโครงการ (ตรวจรับงาน) */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-slate-650 font-bold">วันที่เสร็จสิ้นโครงการ (ตรวจรับงาน)</label>
                <div className="grid grid-cols-3 gap-2">
                  {/* วัน */}
                  <select
                    disabled={isUpdatingContract}
                    value={parseBEParts(editCompletedDate).day}
                    onChange={(e) => handleEditDateDropdownChange('day', e.target.value)}
                    className="border border-slate-200 text-xs rounded-xl px-3 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-semibold text-slate-700 shadow-sm cursor-pointer disabled:opacity-60"
                  >
                    <option value="">วัน</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  {/* เดือน */}
                  <select
                    disabled={isUpdatingContract}
                    value={parseBEParts(editCompletedDate).month}
                    onChange={(e) => handleEditDateDropdownChange('month', e.target.value)}
                    className="border border-slate-200 text-xs rounded-xl px-3 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-semibold text-slate-700 shadow-sm cursor-pointer disabled:opacity-60"
                  >
                    <option value="">เดือน</option>
                    {MONTHS_TH.map(m => (
                      <option key={m.num} value={m.num}>{m.name}</option>
                    ))}
                  </select>

                  {/* ปี พ.ศ. */}
                  <select
                    disabled={isUpdatingContract}
                    value={parseBEParts(editCompletedDate).year}
                    onChange={(e) => handleEditDateDropdownChange('year', e.target.value)}
                    className="border border-slate-200 text-xs rounded-xl px-3 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-semibold text-slate-700 shadow-sm cursor-pointer disabled:opacity-60"
                  >
                    <option value="">ปี พ.ศ.</option>
                    {FISCAL_YEARS.map(y => (
                      <option key={y} value={y}>พ.ศ. {y}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal mt-1.5">
                  * เมื่อแก้ไขเลขที่สัญญาหรือวันที่เสร็จสิ้นโครงการ ระบบจะอัปเดตและคำนวณรายงานผลสัมฤทธิ์ของโครงการนี้ให้ใหม่โดยอัตโนมัติ
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
              <button 
                type="button"
                disabled={isUpdatingContract}
                onClick={() => setEditingProject(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition duration-150 active:scale-97 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="button"
                disabled={isUpdatingContract || !newContractNo.trim()}
                onClick={handleSaveContractNo}
                className="bg-pwa-blue-dark hover:bg-pwa-blue text-white font-bold text-xs px-6 py-2.5 rounded-xl transition duration-150 shadow-md active:scale-97 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUpdatingContract ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  'บันทึกข้อมูล'
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- ADD PROJECT MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200/80 my-8">
            
            {/* Modal Header */}
            <div className="px-8 py-5 bg-gradient-to-r from-pwa-blue-dark to-pwa-blue text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pwa-cyan-light/20 text-pwa-cyan flex items-center justify-center border border-pwa-cyan/35">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">สร้างโครงการ</span>
                  <h3 className="text-base font-bold mt-0.5 leading-snug font-display text-slate-100">
                    เพิ่มโครงการใหม่เข้าสู่ระบบ
                  </h3>
                </div>
              </div>
              
              <button 
                disabled={addLoading}
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-350 hover:text-white hover:bg-slate-700/50 p-2 rounded-xl transition duration-150 active:scale-95 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddProjectSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-8 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-200px)] text-xs">
                
                {addError && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* รหัสโครงการ */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">รหัสโครงการ <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      value={addProjectForm.project_code}
                      onChange={(e) => setAddProjectForm({...addProjectForm, project_code: e.target.value})}
                      placeholder="ป้อนรหัสโครงการ เช่น 64020005"
                      className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition"
                    />
                  </div>

                  {/* เลขที่สัญญา */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">เลขที่สัญญา <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      value={addProjectForm.contract_no}
                      onChange={(e) => setAddProjectForm({...addProjectForm, contract_no: e.target.value})}
                      placeholder="เช่น กปภ.ข.6/34/2564"
                      className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition"
                    />
                  </div>
                </div>

                {/* ชื่อโครงการ */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-650 font-bold">ชื่อโครงการ <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={addProjectForm.project_name}
                    onChange={(e) => setAddProjectForm({...addProjectForm, project_name: e.target.value})}
                    placeholder="ป้อนชื่อโครงการเต็ม"
                    className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* กปภ.สาขา */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">กปภ.สาขา <span className="text-red-500">*</span></label>
                    <select 
                      required
                      value={addProjectForm.branch_name}
                      onChange={(e) => setAddProjectForm({...addProjectForm, branch_name: e.target.value})}
                      className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition cursor-pointer"
                    >
                      <option value="">เลือกสาขาผู้รับผิดชอบ</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.branch_name}>กปภ.สาขา{b.branch_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* ประเภทโครงการ */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">ประเภทโครงการ <span className="text-red-500">*</span></label>
                    <select 
                      required
                      value={addProjectForm.project_type}
                      onChange={(e) => setAddProjectForm({...addProjectForm, project_type: e.target.value})}
                      className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition cursor-pointer"
                    >
                      {Object.entries(PROJECT_TYPES).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* ปีงบประมาณเริ่มต้น */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">ปีงบประมาณเริ่มต้น <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      required
                      value={addProjectForm.start_year}
                      onChange={(e) => setAddProjectForm({...addProjectForm, start_year: parseInt(e.target.value, 10) || ''})}
                      placeholder="เช่น 2568"
                      className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition"
                    />
                  </div>

                  {/* วันที่เสร็จสิ้นโครงการ (ตรวจรับงาน) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">วันที่เสร็จสิ้นโครงการ (ตรวจรับงาน)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {/* วัน */}
                      <select
                        value={parseBEParts(addProjectForm.completed_date).day}
                        onChange={(e) => handleDateDropdownChange('day', e.target.value)}
                        className="border border-slate-200 text-xs rounded-xl px-3 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-semibold text-slate-700 shadow-sm cursor-pointer"
                      >
                        <option value="">วัน</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>

                      {/* เดือน */}
                      <select
                        value={parseBEParts(addProjectForm.completed_date).month}
                        onChange={(e) => handleDateDropdownChange('month', e.target.value)}
                        className="border border-slate-200 text-xs rounded-xl px-3 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-semibold text-slate-700 shadow-sm cursor-pointer"
                      >
                        <option value="">เดือน</option>
                        {MONTHS_TH.map(m => (
                          <option key={m.num} value={m.num}>{m.name}</option>
                        ))}
                      </select>

                      {/* ปี พ.ศ. */}
                      <select
                        value={parseBEParts(addProjectForm.completed_date).year}
                        onChange={(e) => handleDateDropdownChange('year', e.target.value)}
                        className="border border-slate-200 text-xs rounded-xl px-3 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-semibold text-slate-700 shadow-sm cursor-pointer"
                      >
                        <option value="">ปี พ.ศ.</option>
                        {FISCAL_YEARS.map(y => (
                          <option key={y} value={y}>พ.ศ. {y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* งบประมาณ */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">งบประมาณ (บาท) <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      required
                      value={addProjectForm.budget}
                      onChange={(e) => setAddProjectForm({...addProjectForm, budget: parseFloat(e.target.value) || ''})}
                      placeholder="ป้อนวงเงินงบประมาณ"
                      className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition"
                    />
                  </div>

                  {/* เป้าหมายผู้ใช้น้ำ */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">เป้าหมายผู้ใช้น้ำ (ราย) <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      required
                      value={addProjectForm.target_users}
                      onChange={(e) => setAddProjectForm({...addProjectForm, target_users: parseInt(e.target.value, 10) || ''})}
                      placeholder="เช่น 150"
                      className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* พิกัดละติจูด */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">ละติจูด (Latitude)</label>
                    <input 
                      type="text" 
                      value={addProjectForm.latitude}
                      onChange={(e) => setAddProjectForm({...addProjectForm, latitude: e.target.value})}
                      placeholder="เช่น 16.4322"
                      className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition"
                    />
                  </div>

                  {/* พิกัดลองจิจูด */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-650 font-bold">ลองจิจูด (Longitude)</label>
                    <input 
                      type="text" 
                      value={addProjectForm.longitude}
                      onChange={(e) => setAddProjectForm({...addProjectForm, longitude: e.target.value})}
                      placeholder="เช่น 102.8234"
                      className="w-full border border-slate-200 text-xs rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pwa-blue-dark/20 focus:border-pwa-blue-dark font-medium shadow-sm transition"
                    />
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-8 py-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  disabled={addLoading}
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition duration-150 active:scale-97 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={addLoading}
                  className="bg-pwa-blue-dark hover:bg-pwa-blue text-white font-bold text-xs px-6 py-2.5 rounded-xl transition duration-150 shadow-md active:scale-97 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {addLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    'สร้างโครงการ'
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* --- WATER USAGE DETAILS MODAL --- */}
      {isWaterUsageModalOpen && selectedWaterUsageProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200/80 animate-scaleUp">
            {/* Modal Header */}
            <div className="px-8 py-5 bg-gradient-to-r from-blue-900 to-blue-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Droplets className="w-6 h-6 text-cyan-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg font-display">
                    ปริมาณใช้น้ำสะสมและรายได้สะสม รายผู้ใช้น้ำ
                  </h3>
                  <p className="text-xs text-blue-200/90 font-light mt-0.5">
                    โครงการ: <strong className="text-white">{selectedWaterUsageProject.project_name}</strong> ({selectedWaterUsageProject.project_code}) • สัญญา: {selectedWaterUsageProject.contract_no || '-'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsWaterUsageModalOpen(false)}
                className="text-slate-200 hover:text-white hover:bg-slate-700/50 p-2 rounded-xl transition duration-150 active:scale-95 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Filter Bar */}
            <div className="px-8 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between shrink-0">
              <div className="relative w-80">
                <input 
                  type="text" 
                  value={waterUsageModalSearch}
                  onChange={(e) => setWaterUsageModalSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, รหัส หรือที่อยู่ผู้ใช้น้ำ..."
                  className="w-full border border-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                />
                <Search className="w-4 h-4 text-slate-450 absolute left-3 top-2.5" />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">
                  {loadingWaterUsageModalCustomers ? 'กำลังค้นหา...' : `พบผู้ใช้น้ำ ${filteredWaterUsageModalCustomers.length.toLocaleString()} ราย`}
                </span>
                <button 
                  onClick={handleExportWaterUsageModalCustomersCSV}
                  disabled={filteredWaterUsageModalCustomers.length === 0}
                  className="flex items-center gap-1.5 bg-slate-900 text-white font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition duration-150 shadow-sm active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  ส่งออกรายชื่อเป็น CSV
                </button>
              </div>
            </div>

            {/* Modal Content / Table */}
            <div className="flex-1 overflow-y-auto p-8 min-h-0 bg-white">
              {loadingWaterUsageModalCustomers ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <RefreshCw className="w-10 h-10 text-blue-650 animate-spin mb-3" />
                  <p className="text-sm font-semibold animate-pulse font-display text-blue-800">กำลังโหลดรายชื่อผู้ใช้น้ำจากฐานข้อมูล...</p>
                </div>
              ) : filteredWaterUsageModalCustomers.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl animate-scaleUp">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">รหัสผู้ใช้น้ำ</th>
                        <th className="px-4 py-3 font-semibold">ชื่อ-นามสกุล</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">เลขที่มาตร</th>
                        <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">ปริมาณใช้น้ำสะสม (ลบ.ม.)</th>
                        <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">รายได้ค่าน้ำสะสม (บาท)</th>
                        <th className="px-4 py-3 font-semibold">ที่อยู่ผู้ใช้น้ำ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredWaterUsageModalCustomers.map((c) => (
                        <tr key={c.cus_code} className="hover:bg-blue-50/20 transition">
                          <td className="px-4 py-3.5 font-bold font-mono text-slate-800">{c.cus_code}</td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800 whitespace-nowrap">{c.fullName}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-650 whitespace-nowrap">{c.meter_no || '-'}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-blue-600">{c.total_usage.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[.,]000$/, '')}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-emerald-600">{c.total_amount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[.,]000$/, '')}</td>
                          <td className="px-4 py-3.5 text-[11px] text-slate-550 leading-relaxed min-w-[200px]">{c.full_address || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                  <Search className="w-12 h-12 text-slate-300 animate-pulse mb-3" />
                  <p className="text-sm font-semibold text-slate-600">ไม่พบรายชื่อผู้ใช้น้ำที่ตรงกับการค้นหา</p>
                  <p className="text-xs text-slate-450 mt-1">กรุณาลองป้อนคำค้นอื่น ๆ ในกล่องค้นหาด้านบน</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-light">
                * ดึงข้อมูลปริมาณใช้น้ำสะสมและยอดชำระเงินจริง จากตาราง debt_trn
              </span>
              <button 
                onClick={() => setIsWaterUsageModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition duration-150 active:scale-97 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BREAKEVEN PROJECTS LIST MODAL --- */}
      {breakevenModalType !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[75vh] flex flex-col overflow-hidden border border-slate-200/80 animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-8 py-5 bg-gradient-to-r from-pwa-blue-dark to-pwa-blue text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-lg font-display">
                  รายชื่อโครงการประเภทที่ {breakevenModalType}: {PROJECT_TYPES_SHORT[breakevenModalType] || 'โครงการ'} ที่คุ้มทุนแล้ว
                </h3>
                <p className="text-[10px] text-blue-200/90 font-light mt-0.5">
                  พบทั้งหมด {projects.filter(p => p.project_type === breakevenModalType && parseInt(p.total_actual_users || 0) >= parseInt(p.target_users)).length.toLocaleString()} โครงการ จาก {projects.filter(p => p.project_type === breakevenModalType).length.toLocaleString()} โครงการ
                </p>
              </div>
              <button 
                onClick={() => setBreakevenModalType(null)}
                className="text-slate-200 hover:text-white hover:bg-slate-700/50 p-2 rounded-xl transition duration-150 active:scale-95 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto min-h-0 bg-slate-50/50">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="px-5 py-3">รหัสโครงการ</th>
                        <th className="px-5 py-3">เลขที่สัญญา</th>
                        <th className="px-5 py-3">กปภ.สาขา</th>
                        <th className="px-5 py-3">ชื่อโครงการ</th>
                        <th className="px-5 py-3 text-right">เป้าหมาย (ราย)</th>
                        <th className="px-5 py-3 text-right">ผู้ใช้จริง (ราย)</th>
                        <th className="px-5 py-3 text-right">ความสำเร็จ (%)</th>
                        <th className="px-5 py-3 text-center">การกระทำ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-700">
                      {projects
                        .filter(p => p.project_type === breakevenModalType && parseInt(p.total_actual_users || 0) >= parseInt(p.target_users))
                        .map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">{p.project_code}</td>
                            <td className="px-5 py-3 font-mono whitespace-nowrap">{p.contract_no || '-'}</td>
                            <td className="px-5 py-3 font-semibold whitespace-nowrap">{p.branch_name}</td>
                            <td className="px-5 py-3 font-normal max-w-xs truncate" title={p.project_name}>{p.project_name}</td>
                            <td className="px-5 py-3 text-right font-bold text-slate-500">{parseInt(p.target_users || 0).toLocaleString()}</td>
                            <td className="px-5 py-3 text-right font-bold text-emerald-600">{parseInt(p.total_actual_users || 0).toLocaleString()}</td>
                            <td className="px-5 py-3 text-right font-extrabold text-emerald-700">{p.achievement_rate}%</td>
                            <td className="px-5 py-3 text-center">
                              <button
                                onClick={() => {
                                  setSelectedProjectId(p.id);
                                  setBreakevenModalType(null);
                                }}
                                className="px-2.5 py-1 text-[10px] text-white bg-pwa-blue hover:bg-pwa-blue-dark font-extrabold rounded-lg shadow-sm hover:shadow active:scale-95 transition cursor-pointer"
                              >
                                ดูเครื่องมือประเมิน
                              </button>
                            </td>
                          </tr>
                        ))
                      }
                      {projects.filter(p => p.project_type === breakevenModalType && parseInt(p.total_actual_users || 0) >= parseInt(p.target_users)).length === 0 && (
                        <tr>
                          <td colSpan="8" className="px-5 py-10 text-center text-slate-400 font-bold">
                            ไม่มีโครงการที่บรรลุเป้าหมายการประเมินในหมวดหมู่นี้
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
              <button 
                onClick={() => setBreakevenModalType(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition duration-150 active:scale-97 cursor-pointer shadow-sm border border-slate-300/20"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  // Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) setUser(data.data);
      })
      .catch(err => console.error(err))
      .finally(() => setAuthLoading(false));
  }, [API_BASE]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
      setUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-['Sarabun']">กำลังโหลดข้อมูลเซสชัน...</div>;
  }

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return <MainApp user={user} onLogout={handleLogout} />;
}

export default App;
