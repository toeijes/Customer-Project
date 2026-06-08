const express = require('express');
const cors = require('cors');
const db = require('./db');
const cron = require('node-cron');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { logSystemAction } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'pwa6_super_secret_key_12345';

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Authentication Middleware (Cookie-based)
const authenticateToken = (req, res, next) => {
  const token = req.cookies.pwa_auth_session;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Admin Guard Middleware
const requireAdminAuth = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
  });
};

// Write Guard Middleware (Allows non-'user' roles to write)
const requireWriteAuth = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user && req.user.role !== 'user') {
      next();
    } else {
      res.status(403).json({ error: 'Access denied. Write permission required.' });
    }
  });
};

// Protect all API routes except auth login endpoint (Bypassed temporarily)
app.use('/api', (req, res, next) => {
  // Pass through authentication checks for now
  next();
});

// Load Admin Router
const adminRouter = require('./routes/admin');
app.use('/api/admin', requireAdminAuth, adminRouter);

// --- REST APIs ENDPOINTS ---

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    let userPayload = null;
    let localAuthSuccess = false;

    // 1. Local Auth Strategy
    const [localUser] = await db.query(`
      SELECT u.*, r.name as actual_role 
      FROM users u 
      LEFT JOIN user_roles ur ON u.id = ur.user_id 
      LEFT JOIN roles r ON ur.role_id = r.id 
      WHERE u.local_username = ? LIMIT 1
    `, [username]);
    if (localUser && localUser.password) {
      const isMatch = await bcrypt.compare(password, localUser.password);
      if (isMatch) {
        if (!localUser.is_active) {
          return res.status(401).json({ success: false, error: 'Account is deactivated' });
        }
        localAuthSuccess = true;
        await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [localUser.id]);
        userPayload = {
          id: localUser.id,
          username: localUser.local_username,
          fullName: `${localUser.firstname || ''} ${localUser.lastname || ''}`.trim() || localUser.local_username,
          firstname: localUser.firstname,
          lastname: localUser.lastname,
          position: localUser.position,
          level_name: localUser.level_name,
          role: localUser.actual_role || localUser.role
        };
      }
    }

    // 2. PWA Auth Strategy
    if (!localAuthSuccess) {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('pwd', password);

      const response = await fetch('https://intranet.pwa.co.th/login/webservice_login6.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      }).catch(err => null);

      if (!response || !response.ok) {
        // Dev fallback
        if (process.env.NODE_ENV !== 'production' && username === 'dev') {
           userPayload = { id: uuidv4(), username: 'dev', fullName: 'Developer', role: 'admin' };
        } else {
           return res.status(401).json({ success: false, error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง (Local & PWA)' });
        }
      } else {
        const textResult = await response.text();
        const cleanText = textResult.trim().replace(/^\(/, '').replace(/\);?$/, '');
        const intranetResult = JSON.parse(cleanText);
        
        const isSuccess = intranetResult && (intranetResult.success === true || intranetResult.status === 'success' || intranetResult.status === true || intranetResult.code === 200 || intranetResult.emp_id || intranetResult.username);

        if (!isSuccess) {
          return res.status(401).json({ success: false, error: 'ชื่อผู้ใช้งานหรือรหัสผ่านอินทราเน็ตไม่ถูกต้อง', details: intranetResult });
        }

        // Upsert User
        const [existingPwaUser] = await db.query(`
          SELECT u.*, r.name as actual_role 
          FROM users u 
          LEFT JOIN user_roles ur ON u.id = ur.user_id 
          LEFT JOIN roles r ON ur.role_id = r.id 
          WHERE u.pwa_username = ? LIMIT 1
        `, [username]);
        if (existingPwaUser) {
          if (!existingPwaUser.is_active) {
            return res.status(401).json({ success: false, error: 'Account is deactivated' });
          }
          await db.query(`
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP,
                firstname = ?, lastname = ?, email = ?, position = ?,
                level_name = ?, costcenter = ?, ba = ?, part = ?, area = ?,
                job_name = ?, div_name = ?, dep_name = ?, org_name = ?
            WHERE id = ?
          `, [
            intranetResult.firstname || existingPwaUser.firstname,
            intranetResult.lastname || existingPwaUser.lastname,
            intranetResult.email || existingPwaUser.email,
            intranetResult.position || existingPwaUser.position,
            intranetResult.level || existingPwaUser.level_name,
            intranetResult.costcenter || existingPwaUser.costcenter,
            intranetResult.ba || existingPwaUser.ba,
            intranetResult.part || existingPwaUser.part,
            intranetResult.area || existingPwaUser.area,
            intranetResult.job_name || existingPwaUser.job_name,
            intranetResult.div_name || existingPwaUser.div_name,
            intranetResult.dep_name || existingPwaUser.dep_name,
            intranetResult.org_name || existingPwaUser.org_name,
            existingPwaUser.id
          ]);
          userPayload = {
            id: existingPwaUser.id,
            username: existingPwaUser.pwa_username,
            fullName: `${intranetResult.firstname || existingPwaUser.firstname || ''} ${intranetResult.lastname || existingPwaUser.lastname || ''}`.trim() || existingPwaUser.pwa_username,
            firstname: intranetResult.firstname || existingPwaUser.firstname,
            lastname: intranetResult.lastname || existingPwaUser.lastname,
            position: intranetResult.position || existingPwaUser.position,
            level_name: intranetResult.level || existingPwaUser.level_name,
            role: existingPwaUser.actual_role || existingPwaUser.role
          };
        } else {
           // Create new PWA User
           const newId = uuidv4();
           await db.query(`
             INSERT INTO users (id, pwa_username, firstname, lastname, email, position, level_name, costcenter, ba, part, area, job_name, div_name, dep_name, org_name, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
           `, [
             newId, username, 
             intranetResult.firstname || null, 
             intranetResult.lastname || null, 
             intranetResult.email || null, 
             intranetResult.position || null, 
             intranetResult.level || null,
             intranetResult.costcenter || null,
             intranetResult.ba || null, 
             intranetResult.part || null,
             intranetResult.area || null,
             intranetResult.job_name || null,
             intranetResult.div_name || null,
             intranetResult.dep_name || null,
             intranetResult.org_name || null
           ]);
           
           // Default role assignment (user)
           const [userRoleObj] = await db.query('SELECT id FROM roles WHERE name = "user" LIMIT 1');
           if (userRoleObj) {
             await db.query('INSERT INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)', [uuidv4(), newId, userRoleObj.id]);
           }

           userPayload = {
             id: newId,
             username: username,
             fullName: `${intranetResult.firstname || ''} ${intranetResult.lastname || ''}`.trim() || username,
             firstname: intranetResult.firstname || null,
             lastname: intranetResult.lastname || null,
             position: intranetResult.position || null,
             level_name: intranetResult.level || null,
             role: 'user'
           };
        }
      }
    }

    // 3. Generate Session Token (JWT in Cookie)
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '12h' });

    res.cookie('pwa_auth_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    // Log the successful login
    await logSystemAction(req, userPayload, 'LOGIN', 'SYSTEM', null, { strategy: localAuthSuccess ? 'local' : 'pwa' });

    res.json({
      success: true,
      data: {
        isLoggedIn: true,
        user: userPayload
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message, stack: String(error.stack) });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  if (req.user) {
    await logSystemAction(req, req.user, 'LOGOUT', 'SYSTEM');
  }
  res.clearCookie('pwa_auth_session', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ success: true, data: req.user });
});


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

// 4. ดึงสถิติประเมินจำนวนผู้ใช้น้ำตามเป้าหมายโครงการรายโครงการ (Deep-dive Break-even data)
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
    
    // ดึงข้อมูลหลักโครงการ
    const [project] = await db.query('SELECT contract_no, project_name, completed_date, start_year, project_type, completion_year FROM projects WHERE project_code = ?;', [project_code]);
    
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
        COALESCE(c.status, '-') AS status,
        pc.bgncustdt,
        pc.yearinstall,
        c.BGN_DATE AS raw_bgn_date,
        DATE_FORMAT(DATE_ADD(c.BGN_DATE, INTERVAL 543 YEAR), '%e/%c/%Y') AS bgn_date_formatted
      FROM proj_cus pc
      LEFT JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      JOIN projects p ON TRIM(p.contract_no) != '' AND (
        (pc.project_no_proj IS NOT NULL AND TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
        OR
        (pc.project_no_pipe IS NOT NULL AND TRIM(CONVERT(pc.project_no_pipe USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
      )
      WHERE p.project_code = ?;
    `, [project_code]);

    // Helper functions for date parsing
    function parseCompletedDate(dateStr) {
      if (!dateStr) return null;
      const parts = dateStr.trim().split('/');
      if (parts.length !== 3) return null;
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
      return { year: y, month: m, day: d };
    }

    function parseBgncustdt(dateStr) {
      if (!dateStr || dateStr.length !== 6) return null;
      const y = parseInt(dateStr.substring(0, 2), 10) + 2500;
      const m = parseInt(dateStr.substring(2, 4), 10);
      const d = parseInt(dateStr.substring(4, 6), 10);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
      return { year: y, month: m, day: d };
    }

    function parseBgnDate(dateVal) {
      if (!dateVal) return null;
      if (dateVal instanceof Date) {
        return {
          year: dateVal.getFullYear() + 543,
          month: dateVal.getMonth() + 1,
          day: dateVal.getDate()
        };
      }
      if (typeof dateVal === 'string') {
        const parts = dateVal.trim().split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            return { year: y + 543, month: m, day: d };
          }
        }
      }
      return null;
    }

    function isAfter(date1, date2) {
      if (!date1 || !date2) return false;
      if (date1.year !== date2.year) return date1.year > date2.year;
      if (date1.month !== date2.month) return date1.month > date2.month;
      return date1.day > date2.day;
    }

    // Filter customers to only include KPI-eligible ones
    let compDate = parseCompletedDate(project.completed_date);
    if (!compDate && project.start_year) {
      compDate = { year: project.start_year - 1, month: 10, day: 1 };
    }

    const filteredCustomers = customers.filter(c => {
      let bgnDate = parseBgnDate(c.raw_bgn_date);
      if (!bgnDate) {
        bgnDate = parseBgncustdt(c.bgncustdt);
      }
      
      // 1. Must be installed AFTER completion date
      if (!bgnDate || !compDate || !isAfter(bgnDate, compDate)) {
        return false;
      }

      // 2. Must be within the correct fiscal year evaluation range
      // Calculate fiscal year based on bgnDate instead of c.yearinstall
      const year = bgnDate.month >= 10 ? bgnDate.year + 1 : bgnDate.year;
      if (isNaN(year) || year === 0) return false;
      
      const compYear = project.completion_year;
      const type = project.project_type;
      
      if (type === 4) {
        return year === compYear;
      } else {
        return year >= compYear;
      }
    });

    res.json({
      project_code,
      project_name: project.project_name,
      customers: filteredCustomers.map(c => {
        let bgncustdt_formatted = '-';
        if (c.bgn_date_formatted) {
          bgncustdt_formatted = c.bgn_date_formatted;
        } else if (c.bgncustdt && c.bgncustdt.length === 6) {
          bgncustdt_formatted = `${c.bgncustdt.substring(4,6)}/${c.bgncustdt.substring(2,4)}/25${c.bgncustdt.substring(0,2)}`;
        }
        
        return {
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
          status: c.status,
          bgncustdt_formatted
        };
      })
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
        p.project_name,
        p.completed_date,
        p.start_year,
        p.project_type,
        p.completion_year,
        pc.bgncustdt,
        pc.yearinstall,
        c.BGN_DATE AS raw_bgn_date
      FROM proj_cus pc
      JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      JOIN projects p ON TRIM(p.contract_no) != '' AND (
        (pc.project_no_proj IS NOT NULL AND TRIM(CONVERT(pc.project_no_proj USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
        OR
        (pc.project_no_pipe IS NOT NULL AND TRIM(CONVERT(pc.project_no_pipe USING utf8mb4)) COLLATE utf8mb4_unicode_ci = TRIM(p.contract_no))
      )
      WHERE c.LATITUDE IS NOT NULL 
        AND c.LATITUDE != ''
        AND c.LONGITUDE IS NOT NULL 
        AND c.LONGITUDE != ''
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

    // เพิ่ม LIMIT ไว้เยอะหน่อยเพื่อเผื่อโดน Filter ออก
    sql += ' ORDER BY c.cus_code ASC LIMIT 10000;';

    const customers = await db.query(sql, params);

    // Helper functions for date parsing (reuse logic)
    function parseCompletedDate(dateStr) {
      if (!dateStr) return null;
      const parts = dateStr.trim().split('/');
      if (parts.length !== 3) return null;
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
      return { year: y, month: m, day: d };
    }

    function parseBgncustdt(dateStr) {
      if (!dateStr || dateStr.length !== 6) return null;
      const y = parseInt(dateStr.substring(0, 2), 10) + 2500;
      const m = parseInt(dateStr.substring(2, 4), 10);
      const d = parseInt(dateStr.substring(4, 6), 10);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
      return { year: y, month: m, day: d };
    }

    function parseBgnDate(dateVal) {
      if (!dateVal) return null;
      if (dateVal instanceof Date) {
        return { year: dateVal.getFullYear() + 543, month: dateVal.getMonth() + 1, day: dateVal.getDate() };
      }
      if (typeof dateVal === 'string') {
        const parts = dateVal.trim().split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y + 543, month: m, day: d };
        }
      }
      return null;
    }

    function isAfter(date1, date2) {
      if (!date1 || !date2) return false;
      if (date1.year !== date2.year) return date1.year > date2.year;
      if (date1.month !== date2.month) return date1.month > date2.month;
      return date1.day > date2.day;
    }

    // Filter customers to only include KPI-eligible ones
    const filteredCustomers = customers.filter(c => {
      let compDate = parseCompletedDate(c.completed_date);
      if (!compDate && c.start_year) {
        compDate = { year: c.start_year - 1, month: 10, day: 1 };
      }

      let bgnDate = parseBgnDate(c.raw_bgn_date);
      if (!bgnDate) {
        bgnDate = parseBgncustdt(c.bgncustdt);
      }
      
      // 1. Must be installed AFTER completion date
      if (!bgnDate || !compDate || !isAfter(bgnDate, compDate)) {
        return false;
      }

      // 2. Must be within the correct fiscal year evaluation range
      // Calculate fiscal year based on bgnDate instead of c.yearinstall
      const year = bgnDate.month >= 10 ? bgnDate.year + 1 : bgnDate.year;
      if (isNaN(year) || year === 0) return false;
      
      const compYear = c.completion_year;
      const type = c.project_type;
      
      if (type === 4) {
        return year === compYear;
      } else {
        return year >= compYear;
      }
    });

    res.json({
      customers: filteredCustomers.slice(0, 1500).map(c => ({
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
app.put('/api/projects/:project_code/contract', requireWriteAuth, async (req, res) => {
  try {
    const { project_code } = req.params;
    const { contract_no, completed_date } = req.body;

    if (contract_no === undefined) {
      return res.status(400).json({ error: 'contract_no is required' });
    }

    // 1. ดึงรายละเอียดเดิมของโครงการเพื่อใช้ป้อนข้อมูลและคำนวณปีงบประมาณ
    const [project] = await db.query('SELECT project_type, start_year FROM projects WHERE project_code = ?;', [project_code]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const startYear = project.start_year;
    const projectType = project.project_type;

    // 2. คำนวณปีที่แล้วเสร็จตามกฎปีงบประมาณไทย
    let completionYear = startYear;
    if (completed_date && completed_date.trim()) {
      const parts = completed_date.trim().split('/');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m)) {
          completionYear = m >= 10 ? y + 1 : y;
        }
      }
    }

    // 3. อัปเดตข้อมูลหัวโครงการ
    await db.query(
      'UPDATE projects SET contract_no = ?, completed_date = ?, completion_year = ? WHERE project_code = ?;',
      [contract_no.trim(), completed_date ? completed_date.trim() : null, completionYear, project_code]
    );

    // 4. คำนวณพิกัดเฉลี่ยใหม่จากตำแหน่งผู้ใช้น้ำจริงของเลขที่สัญญานี้
    const [coords] = await db.query(`
      SELECT 
        AVG(CAST(c.LATITUDE AS DOUBLE)) AS avg_lat,
        AVG(CAST(c.LONGITUDE AS DOUBLE)) AS avg_lng
      FROM proj_cus pc
      JOIN customer c ON CONVERT(pc.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      WHERE c.LATITUDE IS NOT NULL AND c.LATITUDE != '' AND c.LATITUDE != '0'
        AND c.LONGITUDE IS NOT NULL AND c.LONGITUDE != '' AND c.LONGITUDE != '0'
        AND (TRIM(pc.project_no_proj) = ? OR TRIM(pc.project_no_pipe) = ?);
    `, [contract_no.trim(), contract_no.trim()]);
    
    if (coords && coords.avg_lat) {
      await db.query(
        'UPDATE projects SET latitude = ?, longitude = ? WHERE project_code = ?;',
        [coords.avg_lat, coords.avg_lng, project_code]
      );
    }

    // 5. ดึงข้อมูลประวัติการเชื่อมสายท่อจริงของผู้ใช้ (Installations) เพื่อคำนวณผลงานสะสม
    const rawActuals = await db.query(`
      SELECT 
        pc.custcode,
        pc.yearinstall,
        pc.contrac_date,
        pc.bgncustdt
      FROM proj_cus pc
      WHERE (TRIM(pc.project_no_proj) = ? OR TRIM(pc.project_no_pipe) = ?) AND pc.yearinstall IS NOT NULL AND pc.yearinstall != '';
    `, [contract_no.trim(), contract_no.trim()]);

    let compDate = null;
    if (completed_date && completed_date.trim()) {
      const parts = completed_date.trim().split('/');
      if (parts.length === 3) {
        compDate = { year: parseInt(parts[2], 10), month: parseInt(parts[1], 10), day: parseInt(parts[0], 10) };
      }
    }
    if (!compDate) {
      compDate = { year: startYear - 1, month: 10, day: 1 };
    }

    // รวมกลุ่มข้อมูลในหน่วยความจำ
    const actualsMap = {};
    const eligibleCustomersRows = [];
    const seenCustomers = new Set();

    rawActuals.forEach(row => {
      let bgnDate = null;
      if (row.bgncustdt && row.bgncustdt.length === 6) {
        const y = parseInt(row.bgncustdt.substring(0, 2), 10) + 2500;
        const m = parseInt(row.bgncustdt.substring(2, 4), 10);
        const d = parseInt(row.bgncustdt.substring(4, 6), 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          bgnDate = { year: y, month: m, day: d };
        }
      }
      
      if (bgnDate && compDate) {
        const isAfter = bgnDate.year !== compDate.year 
          ? bgnDate.year > compDate.year 
          : (bgnDate.month !== compDate.month ? bgnDate.month > compDate.month : bgnDate.day > compDate.day);
        
        if (!isAfter) return;
      }

      const year = parseInt(row.yearinstall || 0);
      if (isNaN(year) || year === 0) return;

      let month = 10;
      if (row.contrac_date && row.contrac_date.length >= 4) {
        const mVal = parseInt(row.contrac_date.substring(2, 4), 10);
        if (!isNaN(mVal) && mVal >= 1 && mVal <= 12) {
          month = mVal;
        }
      }

      if (!actualsMap[year]) actualsMap[year] = {};
      actualsMap[year][month] = (actualsMap[year][month] || 0) + 1;

      // Track eligible customer
      const key = `${project_code}-${row.custcode}`;
      if (!seenCustomers.has(key)) {
        seenCustomers.add(key);
        eligibleCustomersRows.push([project_code, row.custcode, year, month]);
      }
    });

    // 6. ลบข้อมูลผลรวมเดิมและเขียนข้อมูลใหม่
    await db.query('DELETE FROM project_yearly_performance WHERE project_code = ?;', [project_code]);
    await db.query('DELETE FROM monthly_actual_users WHERE project_code = ?;', [project_code]);
    await db.query('DELETE FROM eligible_customers WHERE project_code = ?;', [project_code]);

    if (eligibleCustomersRows.length > 0) {
      await db.query(`
        INSERT INTO eligible_customers 
          (project_code, custcode, fiscal_year, month_number)
        VALUES ?;
      `, [eligibleCustomersRows]);
    }

    const [projHeader] = await db.query('SELECT target_users, project_name, branch_name FROM projects WHERE project_code = ?;', [project_code]);
    const target = projHeader.target_users;
    const pName = projHeader.project_name;
    const bName = projHeader.branch_name;

    const yearlyRows = [];
    if (projectType === 4) {
      const yearSum = actualsMap[completionYear] 
        ? Object.values(actualsMap[completionYear]).reduce((sum, v) => sum + v, 0)
        : 0;
      yearlyRows.push([project_code, completionYear, 'completion_year', 100, target, yearSum]);
    } else {
      const allocations = [40, 0, 15, 15, 15, 15];
      for (let i = 0; i <= 5; i++) {
        const currentYear = completionYear + i;
        const yearType = i === 0 ? 'completion_year' : i <= 4 ? `year_${i}` : 'year_5_plus';
        const targetPct = allocations[i];
        const yrTargetUsers = Math.round(target * (targetPct / 100));

        let actualVal = 0;
        if (i === 5) {
          for (const yrStr in actualsMap) {
            const yr = parseInt(yrStr);
            if (yr >= completionYear + 5) {
              actualVal += Object.values(actualsMap[yr]).reduce((sum, v) => sum + v, 0);
            }
          }
        } else {
          actualVal = actualsMap[currentYear] 
            ? Object.values(actualsMap[currentYear]).reduce((sum, v) => sum + v, 0)
            : 0;
        }

        yearlyRows.push([project_code, currentYear, yearType, targetPct, yrTargetUsers, actualVal]);
      }
    }

    if (yearlyRows.length > 0) {
      await db.query(`
        INSERT INTO project_yearly_performance 
          (project_code, fiscal_year, year_type, target_percentage, target_users, actual_users)
        VALUES ?;
      `, [yearlyRows]);
    }

    const monthlyRows = [];
    for (const yrStr in actualsMap) {
      const yr = parseInt(yrStr);
      let isValidYear = (projectType === 4) ? (yr === completionYear) : (yr >= completionYear);
      if (!isValidYear) continue;

      const MONTH_NAMES_TH = {
        1: 'ม.ค.', 2: 'ก.พ.', 3: 'มี.ค.', 4: 'เม.ย.', 5: 'พ.ค.', 6: 'มิ.ย.',
        7: 'ก.ค.', 8: 'ส.ค.', 9: 'ก.ย.', 10: 'ต.ค.', 11: 'พ.ย.', 12: 'ธ.ค.'
      };

      for (const mStr in actualsMap[yr]) {
        const m = parseInt(mStr);
        const count = actualsMap[yr][m];
        if (count > 0) {
          monthlyRows.push([
            project_code,
            pName,
            bName,
            projectType,
            yr,
            m,
            MONTH_NAMES_TH[m] || 'ม.ค.',
            count
          ]);
        }
      }
    }

    if (monthlyRows.length > 0) {
      await db.query(`
        INSERT INTO monthly_actual_users 
          (project_code, project_name, branch_name, project_type, fiscal_year, month_number, month_name, actual_users)
        VALUES ?;
      `, [monthlyRows]);
    }

    res.json({ message: 'Project details and statistics updated successfully', project_code, contract_no, completed_date });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project data', details: error.message });
  }
});

// 8. สร้างโครงการใหม่ (Manual Entry)
app.post('/api/projects', requireWriteAuth, async (req, res) => {
  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    const {
      project_code,
      contract_no,
      branch_name,
      project_name,
      project_type,
      start_year,
      completed_date,
      budget,
      target_users,
      latitude,
      longitude
    } = req.body;

    if (!project_code || !contract_no || !project_name || !branch_name || !project_type || !start_year || budget === undefined || target_users === undefined) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }

    // Check if project code already exists
    const [existing] = await connection.query('SELECT id FROM projects WHERE project_code = ?;', [project_code.trim()]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'รหัสโครงการนี้มีอยู่แล้วในระบบ' });
    }

    // Parse completion_year from completed_date or fallback to start_year
    let completionYear = parseInt(start_year);
    if (completed_date) {
      const parts = completed_date.trim().split('/');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m)) {
          completionYear = m >= 10 ? y + 1 : y;
        }
      }
    }

    // Insert into projects
    await connection.query(`
      INSERT INTO projects 
        (project_code, contract_no, branch_name, project_name, project_type, start_year, completion_year, completed_date, budget, target_users, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      project_code.trim(),
      (contract_no || '').trim(),
      branch_name.trim(),
      project_name.trim(),
      parseInt(project_type),
      parseInt(start_year),
      completionYear,
      completed_date ? completed_date.trim() : null,
      parseFloat(budget),
      parseInt(target_users),
      latitude && latitude !== '' ? parseFloat(latitude) : null,
      longitude && longitude !== '' ? parseFloat(longitude) : null
    ]);

    // Generate yearly performance records based on type
    const pType = parseInt(project_type);
    const cYear = completionYear;
    const tUsers = parseInt(target_users);

    const performanceRows = [];
    if (pType === 4) {
      performanceRows.push([
        project_code.trim(),
        cYear,
        'completion_year',
        100.00,
        tUsers,
        0
      ]);
    } else {
      const allocations = [40, 0, 15, 15, 15, 15];
      for (let i = 0; i <= 5; i++) {
        const currentYear = cYear + i;
        const yearType = i === 0 ? 'completion_year' : i <= 4 ? `year_${i}` : 'year_5_plus';
        const targetPct = allocations[i];
        const yrTargetUsers = Math.round(tUsers * (targetPct / 100));

        performanceRows.push([
          project_code.trim(),
          currentYear,
          yearType,
          targetPct,
          yrTargetUsers,
          0
        ]);
      }
    }

    if (performanceRows.length > 0) {
      await connection.query(`
        INSERT INTO project_yearly_performance 
          (project_code, fiscal_year, year_type, target_percentage, target_users, actual_users)
        VALUES ?;
      `, [performanceRows]);
    }

    await connection.commit();
    res.json({ message: 'สร้างโครงการใหม่สำเร็จ', project_code });

  } catch (error) {
    await connection.rollback();
    console.error('Failed to create project:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างโครงการใหม่ได้', details: error.message });
  } finally {
    connection.release();
  }
});


// ดึงข้อมูลวิเคราะห์ประเมินการใช้น้ำ (Water Consumption Analysis)
app.get('/api/water-usage/summary', async (req, res) => {
  try {
    const { branch, year, type } = req.query;

    // Build filter parts
    let whereClauses = [];
    let params = [];

    if (branch && branch !== 'all') {
      whereClauses.push('p.branch_name = ?');
      params.push(branch);
    }
    if (type && type !== 'all') {
      whereClauses.push('p.project_type = ?');
      params.push(parseInt(type));
    }
    if (year && year !== 'all') {
      whereClauses.push('(CAST(SUBSTRING(dt.debt_ym, 1, 4) AS SIGNED) + CASE WHEN CAST(SUBSTRING(dt.debt_ym, 5, 2) AS SIGNED) >= 10 THEN 1 ELSE 0 END) = ?');
      params.push(parseInt(year));
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    // 1. Query Summary Metrics
    const metricsPromise = db.query(`
      SELECT 
        COUNT(DISTINCT dt.cust_code) as total_users,
        COUNT(dt.id) as total_bills,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
    `, params);

    // 2. Query Monthly Breakdown
    const monthlyPromise = db.query(`
      SELECT 
        SUBSTRING(dt.debt_ym, 5, 2) as month_num,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
      GROUP BY SUBSTRING(dt.debt_ym, 5, 2)
    `, params);

    // 3. Query Yearly Breakdown
    const yearlyPromise = db.query(`
      SELECT 
        (CAST(SUBSTRING(dt.debt_ym, 1, 4) AS SIGNED) + CASE WHEN CAST(SUBSTRING(dt.debt_ym, 5, 2) AS SIGNED) >= 10 THEN 1 ELSE 0 END) as fiscal_year,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
      GROUP BY (CAST(SUBSTRING(dt.debt_ym, 1, 4) AS SIGNED) + CASE WHEN CAST(SUBSTRING(dt.debt_ym, 5, 2) AS SIGNED) >= 10 THEN 1 ELSE 0 END)
      ORDER BY fiscal_year DESC
    `, params);

    // 4. Query Branch Breakdown
    const branchPromise = db.query(`
      SELECT 
        p.branch_name,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
      GROUP BY p.branch_name
      ORDER BY total_usage DESC
    `, params);

    // 5. Query Project Breakdown
    const projectPromise = db.query(`
      SELECT 
        p.project_code,
        p.contract_no,
        p.project_name,
        p.project_type,
        p.branch_name,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
      GROUP BY p.project_code, p.contract_no, p.project_name, p.project_type, p.branch_name
      ORDER BY total_usage DESC
    `, params);

    const [metricsResult, monthlyRaw, yearlyResult, branchResult, projectResult] = await Promise.all([
      metricsPromise,
      monthlyPromise,
      yearlyPromise,
      branchPromise,
      projectPromise
    ]);

    // Format monthly data in fiscal year order (October to September)
    const MONTH_MAP_TH = {
      '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.', 
      '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.', '05': 'พ.ค.', '06': 'มิ.ย.',
      '07': 'ก.ค.', '08': 'ส.ค.', '09': 'ก.ย.'
    };
    const fiscalMonthsOrder = ['10', '11', '12', '01', '02', '03', '04', '05', '06', '07', '08', '09'];

    const monthlyMap = {};
    monthlyRaw.forEach(row => {
      monthlyMap[row.month_num] = {
        total_usage: parseInt(row.total_usage || 0),
        total_amount: parseFloat(row.total_amount || 0)
      };
    });

    const monthlyResultFormatted = fiscalMonthsOrder.map(mNum => {
      const data = monthlyMap[mNum] || { total_usage: 0, total_amount: 0 };
      return {
        month_num: mNum,
        month_name: MONTH_MAP_TH[mNum],
        total_usage: data.total_usage,
        total_amount: data.total_amount
      };
    });

    res.json({
      metrics: {
        total_users: parseInt(metricsResult[0]?.total_users || 0),
        total_bills: parseInt(metricsResult[0]?.total_bills || 0),
        total_usage: parseInt(metricsResult[0]?.total_usage || 0),
        total_amount: parseFloat(metricsResult[0]?.total_amount || 0)
      },
      monthly: monthlyResultFormatted,
      yearly: yearlyResult.map(y => ({
        fiscal_year: parseInt(y.fiscal_year),
        total_usage: parseInt(y.total_usage || 0),
        total_amount: parseFloat(y.total_amount || 0)
      })),
      branches: branchResult.map(b => ({
        branch_name: b.branch_name,
        total_usage: parseInt(b.total_usage || 0),
        total_amount: parseFloat(b.total_amount || 0)
      })),
      projects: projectResult.map(p => ({
        project_code: p.project_code,
        contract_no: p.contract_no,
        project_name: p.project_name,
        project_type: parseInt(p.project_type),
        branch_name: p.branch_name,
        total_usage: parseInt(p.total_usage || 0),
        total_amount: parseFloat(p.total_amount || 0)
      }))
    });

  } catch (error) {
    console.error('Water usage summary error:', error);
    res.status(500).json({ error: 'Failed to fetch water usage summary', details: error.message });
  }
});


// ดึงข้อมูลรายชื่อผู้ใช้น้ำทั้งหมดตามเงื่อนไขตัวกรอง (Water Usage All Customers)
app.get('/api/water-usage/customers', async (req, res) => {
  try {
    const { branch, year, type } = req.query;

    let whereClauses = [];
    let params = [];

    if (branch && branch !== 'all') {
      whereClauses.push('p.branch_name = ?');
      params.push(branch);
    }
    if (type && type !== 'all') {
      whereClauses.push('p.project_type = ?');
      params.push(parseInt(type));
    }
    if (year && year !== 'all') {
      whereClauses.push('(CAST(SUBSTRING(dt.debt_ym, 1, 4) AS SIGNED) + CASE WHEN CAST(SUBSTRING(dt.debt_ym, 5, 2) AS SIGNED) >= 10 THEN 1 ELSE 0 END) = ?');
      params.push(parseInt(year));
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const customers = await db.query(`
      SELECT 
        ec.custcode AS cus_code,
        COALESCE(c.fullName, 'ไม่พบรายชื่อในฐานข้อมูล') AS fullName,
        COALESCE(c.meter_no, '-') AS meter_no,
        COALESCE(c.full_address, 'ไม่พบที่อยู่ในฐานข้อมูล') AS full_address,
        p.project_code,
        p.project_name,
        p.branch_name,
        COALESCE(SUM(dt.present_water_usg), 0) AS total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) AS total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      LEFT JOIN customer c ON CONVERT(ec.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      ${whereSql}
      GROUP BY ec.custcode, c.fullName, c.meter_no, c.full_address, p.project_code, p.project_name, p.branch_name
      ORDER BY total_usage DESC
    `, params);

    res.json({
      customers: customers.map(c => ({
        cus_code: c.cus_code,
        fullName: c.fullName,
        meter_no: c.meter_no,
        full_address: c.full_address,
        project_code: c.project_code,
        project_name: c.project_name,
        branch_name: c.branch_name,
        total_usage: parseInt(c.total_usage || 0),
        total_amount: parseFloat(c.total_amount || 0)
      }))
    });
  } catch (error) {
    console.error('Failed to fetch filtered water usage customers:', error);
    res.status(500).json({ error: 'Failed to fetch water usage customers', details: error.message });
  }
});


// ดึงข้อมูลการใช้น้ำรายผู้ใช้น้ำของแต่ละโครงการ
app.get('/api/project-customers-water-usage/:project_code', async (req, res) => {
  try {
    const { project_code } = req.params;

    const customers = await db.query(`
      SELECT 
        ec.custcode AS cus_code,
        COALESCE(c.fullName, 'ไม่พบรายชื่อในฐานข้อมูล') AS fullName,
        COALESCE(c.meter_no, '-') AS meter_no,
        COALESCE(c.full_address, 'ไม่พบที่อยู่ในฐานข้อมูล') AS full_address,
        COALESCE(SUM(dt.present_water_usg), 0) AS total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) AS total_amount
      FROM eligible_customers ec
      LEFT JOIN customer c ON CONVERT(ec.custcode USING utf8mb4) COLLATE utf8mb4_unicode_ci = c.cus_code
      LEFT JOIN debt_trn dt ON ec.custcode = dt.cust_code
      WHERE ec.project_code = ?
      GROUP BY ec.custcode, c.fullName, c.meter_no, c.full_address
      ORDER BY total_usage DESC
    `, [project_code]);

    res.json({
      project_code,
      customers: customers.map(c => ({
        cus_code: c.cus_code,
        fullName: c.fullName,
        meter_no: c.meter_no,
        full_address: c.full_address,
        total_usage: parseInt(c.total_usage || 0),
        total_amount: parseFloat(c.total_amount || 0)
      }))
    });
  } catch (error) {
    console.error('Project customers water usage error:', error);
    res.status(500).json({ error: 'Failed to fetch project customers water usage', details: error.message });
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

// --- CRON JOBS ---
// รันอัปเดตข้อมูลดิบ (migrate.js) อัตโนมัติทุกวันเวลาเที่ยงคืน (00:00)
cron.schedule('0 0 * * *', () => {
  console.log(`\n[CRON ${new Date().toISOString()}] เริ่มต้นรันสคริปต์อัปเดตข้อมูลอัตโนมัติ (migrate.js)...`);
  exec('node migrate.js', { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[CRON Error] ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`[CRON Stderr] ${stderr}`);
    }
    console.log(`[CRON Success] อัปเดตข้อมูลอัตโนมัติเสร็จสิ้น:\n${stdout}`);
  });
});

startServer();
