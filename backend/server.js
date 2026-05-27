const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- REST APIs ENDPOINTS ---

// 1. ดึงรายชื่อสาขาทั้งหมด
app.get('/api/branches', async (req, res) => {
  try {
    const branches = await db.query('SELECT * FROM pwa_branches ORDER BY ba ASC;');
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches', details: error.message });
  }
});

// 2. ดึงรายชื่อโครงการทั้งหมด พร้อมผลรวมสะสมเป้าหมายจริงและอัตราส่วนความสำเร็จ
app.get('/api/projects', async (req, res) => {
  try {
    // ดึงโครงการทั้งหมด
    const projects = await db.query(`
      SELECT p.*, b.ba 
      FROM projects p
      LEFT JOIN pwa_branches b ON p.branch_name = b.branch_name
      ORDER BY b.ba ASC, p.project_code ASC;
    `);
    
    // ดึงยอดจริงสะสมของแต่ละโครงการเพื่อลดภาระการประมวลผลบน React
    const actuals = await db.query(`
      SELECT project_code, SUM(actual_users) as total_actual_users 
      FROM project_yearly_performance 
      GROUP BY project_code;
    `);

    // แมปยอดจริงสะสมใส่เข้าไปในรายการโครงการ
    const actualsMap = {};
    actuals.forEach(act => {
      actualsMap[act.project_code] = parseInt(act.total_actual_users || 0);
    });

    const enrichedProjects = projects.map(p => {
      const totalActual = actualsMap[p.project_code] || 0;
      return {
        ...p,
        total_actual_users: totalActual,
        achievement_rate: p.target_users > 0 ? ((totalActual / p.target_users) * 100).toFixed(1) : '0.0'
      };
    });

    res.json(enrichedProjects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
  }
});

// 3. ดึงสถิติรายเดือนสำหรับรายสาขาและ Matrix Grid (มีระบบตัวกรองผ่าน query params)
app.get('/api/monthly-data', async (req, res) => {
  try {
    const { branch, year, type } = req.query;
    
    let sql = 'SELECT * FROM monthly_actual_users WHERE 1=1';
    const params = [];

    if (branch && branch !== 'all') {
      sql += ' AND branch_name = ?';
      params.push(branch);
    }
    if (year && year !== 'all') {
      sql += ' AND fiscal_year = ?';
      params.push(parseInt(year));
    }
    if (type && type !== 'all') {
      sql += ' AND project_type = ?';
      params.push(parseInt(type));
    }

    sql += ' ORDER BY fiscal_year DESC, month_number ASC;';
    
    const data = await db.query(sql, params);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monthly data', details: error.message });
  }
});

// 4. ดึงสถิติจุดคุ้มทุนแยกรายโครงการเป้าหมาย (Deep-dive Break-even data)
app.get('/api/project-breakeven/:project_code', async (req, res) => {
  try {
    const { project_code } = req.params;
    
    // ดึงข้อมูลหลักโครงการ
    const [project] = await db.query('SELECT * FROM projects WHERE project_code = ?;', [project_code]);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ดึงข้อมูลการประมวลผลรายปี
    const performance = await db.query(
      'SELECT * FROM project_yearly_performance WHERE project_code = ? ORDER BY fiscal_year ASC;',
      [project_code]
    );

    res.json({
      project,
      performance
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project break-even analysis', details: error.message });
  }
});

// 5. ดึงข้อมูลพิกัดและรายละเอียดผู้ใช้รายโครงการ สำหรับแสดงบนแผนที่
app.get('/api/project-customers/:project_code', async (req, res) => {
  try {
    const { project_code } = req.params;
    
    // ดึงข้อมูลหลักโครงการเพื่อเอาเลขสัญญา (contract_no)
    const [project] = await db.query('SELECT contract_no, project_name FROM projects WHERE project_code = ?;', [project_code]);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ดึงรายชื่อผู้ใช้พร้อมพิกัด โดยใช้ CONVERT/COLLATE เพื่อหลีกเลี่ยง collation mismatch
    // ใช้ LEFT JOIN customer เพื่อให้ดึงข้อมูลจาก proj_cus ได้แม้จะไม่มีประวัติในตาราง customer
    // และ TRIM เลขที่สัญญาทั้งสองฝั่งเพื่อรองรับกรณีที่มีเว้นวรรค
    const customers = await db.query(`
      SELECT 
        pc.custcode AS cus_code, 
        COALESCE(c.fullName, 'ไม่พบรายชื่อในฐานข้อมูล') AS fullName, 
        c.LATITUDE, 
        c.LONGITUDE, 
        COALESCE(c.full_address, 'ไม่พบที่อยู่ในฐานข้อมูล') AS full_address,
        COALESCE(c.meter_no, pc.meterno) AS meter_no,
        COALESCE(c.use_Name, '-') AS use_Name,
        COALESCE(c.brandName, '-') AS brandName,
        COALESCE(c.sizeName, '-') AS sizeName,
        COALESCE(c.present_meter_count, 0) AS present_meter_count,
        COALESCE(c.status, '-') AS status
      FROM proj_cus pc
      LEFT JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      JOIN projects p ON TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no)
      WHERE p.project_code = ?
        AND TRIM(p.contract_no) != ''
        AND TRIM(pc.project_no_proj) != '';
    `, [project_code]);

    res.json({
      project_code,
      project_name: project.project_name,
      customers: customers.map(c => ({
        cus_code: c.cus_code,
        fullName: c.fullName,
        latitude: c.LATITUDE && c.LATITUDE !== '' ? parseFloat(c.LATITUDE) : null,
        longitude: c.LONGITUDE && c.LONGITUDE !== '' ? parseFloat(c.LONGITUDE) : null,
        full_address: c.full_address,
        meter_no: c.meter_no,
        use_Name: c.use_Name,
        brandName: c.brandName,
        sizeName: c.sizeName,
        present_meter_count: c.present_meter_count,
        status: c.status
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project customers', details: error.message });
  }
});

// 6. ดึงข้อมูลพิกัดและรายละเอียดผู้ใช้น้ำทั้งหมด (รองรับตัวกรอง Branch, Year, Type เพื่อแสดงบนแผนที่ภาพรวม)
app.get('/api/customers-coordinates', async (req, res) => {
  try {
    const { branch, year, type } = req.query;
    
    let sql = `
      SELECT 
        c.cus_code, 
        c.fullName, 
        c.LATITUDE, 
        c.LONGITUDE, 
        c.full_address,
        c.meter_no,
        p.project_code,
        p.project_name
      FROM proj_cus pc
      JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      JOIN projects p ON TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no)
      WHERE c.LATITUDE IS NOT NULL 
        AND c.LATITUDE != ''
        AND c.LONGITUDE IS NOT NULL 
        AND c.LONGITUDE != ''
        AND TRIM(p.contract_no) != ''
        AND TRIM(pc.project_no_proj) != ''
    `;
    const params = [];

    if (branch && branch !== 'all') {
      sql += ' AND p.branch_name = ?';
      params.push(branch);
    }
    if (year && year !== 'all') {
      sql += ' AND p.completion_year = ?';
      params.push(parseInt(year));
    }
    if (type && type !== 'all') {
      sql += ' AND p.project_type = ?';
      params.push(parseInt(type));
    }

    // จำกัดจำนวนเพื่อป้องกันปัญหาฝั่ง Client ค้างหากโหลดข้อมูลพร้อมกันหลักหมื่นจุด
    sql += ' ORDER BY c.cus_code ASC LIMIT 1500;';

    const customers = await db.query(sql, params);

    res.json({
      customers: customers.map(c => ({
        cus_code: c.cus_code,
        fullName: c.fullName,
        latitude: parseFloat(c.LATITUDE),
        longitude: parseFloat(c.LONGITUDE),
        full_address: c.full_address,
        meter_no: c.meter_no,
        project_code: c.project_code,
        project_name: c.project_name
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global customers coordinates', details: error.message });
  }
});

// 7. อัปเดตเลขที่สัญญาของโครงการ
app.put('/api/projects/:project_code/contract', async (req, res) => {
  try {
    const { project_code } = req.params;
    const { contract_no } = req.body;

    if (contract_no === undefined) {
      return res.status(400).json({ error: 'contract_no is required' });
    }

    // อัปเดตตาราง projects
    const result = await db.query(
      'UPDATE projects SET contract_no = ? WHERE project_code = ?;',
      [contract_no.trim(), project_code]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Contract number updated successfully', project_code, contract_no });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update contract number', details: error.message });
  }
});


// --- SERVER STARTUP ---
async function startServer() {
  try {
    // รอเชื่อมฐานข้อมูล MySQL ก่อนรันเว็บ API
    await db.initializeDatabase();
    
    app.listen(PORT, () => {
      const dbHost = process.env.DB_HOST || '127.0.0.1';
      const dbPort = process.env.DB_PORT || '3306';
      const dbName = process.env.DB_DATABASE || 'pwa6_expansion';
      console.log('\n==================================================');
      console.log(` PWA Area 6 System API Server started successfully.`);
      console.log(` - Port: http://localhost:${PORT}`);
      console.log(` - MySQL: ${dbHost}:${dbPort} (${dbName})`);
      console.log('==================================================\n');
    });
  } catch (error) {
    console.error('✗ Failed to start API Server due to database issue:', error.message);
    process.exit(1);
  }
}

startServer();
