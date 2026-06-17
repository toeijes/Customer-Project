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

const requireWriteAuth = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user && req.user.role !== 'user' && req.user.role !== 'Other') {
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
        let role = localUser.actual_role || localUser.role;

        // Upgrade from 'Other' to 'user' if their area becomes 6
        if (localUser.area == 6 && role === 'Other') {
          const [targetRoleObj] = await db.query('SELECT id FROM roles WHERE name = "user" LIMIT 1');
          if (targetRoleObj) {
            await db.query('DELETE FROM user_roles WHERE user_id = ?', [localUser.id]);
            await db.query('INSERT INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)', [uuidv4(), localUser.id, targetRoleObj.id]);
            role = 'user';
          }
        }

        // If they are not in Region 6 and their role is 'Other', block login!
        if (role !== 'admin' && role === 'Other' && localUser.area != 6) {
          return res.status(403).json({
            success: false,
            error: 'ท่านไม่ได้อยู่ภายใต้สังกัด การประปาส่วนภูมิภาคเขต 6 หากต้องการเข้าใช้งานระบบ กรุณาติดต่อ Admin ผู้ดูแลระบบ งานประมวลข้อมูล กองเทคโนโลยีสารสนเทศ กปภ.ข.6'
          });
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
          area: localUser.area,
          role: role
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
          const userArea = intranetResult.area !== undefined ? intranetResult.area : existingPwaUser.area;
          let role = existingPwaUser.actual_role || existingPwaUser.role;

          // Upgrade from 'Other' to 'user' if their area becomes 6
          if (userArea == 6 && role === 'Other') {
            const [targetRoleObj] = await db.query('SELECT id FROM roles WHERE name = "user" LIMIT 1');
            if (targetRoleObj) {
              await db.query('DELETE FROM user_roles WHERE user_id = ?', [existingPwaUser.id]);
              await db.query('INSERT INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)', [uuidv4(), existingPwaUser.id, targetRoleObj.id]);
              role = 'user';
            }
          }

          // If they are not in Region 6 and their role is 'Other', block login!
          if (role !== 'admin' && role === 'Other' && userArea != 6) {
            return res.status(403).json({
              success: false,
              error: 'ท่านไม่ได้อยู่ภายใต้สังกัด การประปาส่วนภูมิภาคเขต 6 หากต้องการเข้าใช้งานระบบ กรุณาติดต่อ Admin ผู้ดูแลระบบ งานประมวลข้อมูล กองเทคโนโลยีสารสนเทศ กปภ.ข.6'
            });
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
            area: userArea,
            role: role
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
           
           // Default role assignment (user if area == 6, Other if area != 6)
           const targetRoleName = intranetResult.area == 6 ? 'user' : 'Other';
           const [userRoleObj] = await db.query('SELECT id FROM roles WHERE name = ? LIMIT 1', [targetRoleName]);
           if (userRoleObj) {
             await db.query('INSERT INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)', [uuidv4(), newId, userRoleObj.id]);
           }

           // If they are not under Region 6, block login (they are now saved in DB so admin can update role)
           if (intranetResult.area != 6) {
             return res.status(403).json({
               success: false,
               error: 'ท่านไม่ได้อยู่ภายใต้สังกัด การประปาส่วนภูมิภาคเขต 6 หากต้องการเข้าใช้งานระบบ กรุณาติดต่อ Admin ผู้ดูแลระบบ งานประมวลข้อมูล กองเทคโนโลยีสารสนเทศ กปภ.ข.6'
             });
           }

           userPayload = {
             id: newId,
             username: username,
             fullName: `${intranetResult.firstname || ''} ${intranetResult.lastname || ''}`.trim() || username,
             firstname: intranetResult.firstname || null,
             lastname: intranetResult.lastname || null,
             position: intranetResult.position || null,
             level_name: intranetResult.level || null,
             area: intranetResult.area || null,
             role: targetRoleName
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
    // ดึงโครงการทั้งหมด (กรองข้อมูลจริงที่ไม่ใช่ Mock data และอยู่ใน 4 ประเภทโครงการประเมินเท่านั้น)
    const projects = await db.query(`
      SELECT p.*, b.ba 
      FROM projects p
      LEFT JOIN pwa_branches b ON p.branch_name = b.branch_name
      WHERE p.project_code NOT LIKE 'PWA6-%' AND p.project_type IN (1, 2, 3, 4)
      ORDER BY b.ba ASC, p.project_code ASC;
    `);
    
    // ดึงยอดจริงสะสมของแต่ละโครงการเพื่อลดภาระการประมวลผลบน React
    const actuals = await db.query(`
      SELECT project_code, SUM(actual_users) as total_actual_users 
      FROM project_yearly_performance 
      WHERE project_code NOT LIKE 'PWA6-%'
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
    
    let sql = `
      SELECT m.*, p.contract_no 
      FROM monthly_actual_users m
      LEFT JOIN projects p ON m.project_code = p.project_code
      WHERE m.project_code NOT LIKE 'PWA6-%' AND m.project_type IN (1, 2, 3, 4)
    `;
    const params = [];

    if (branch && branch !== 'all') {
      sql += ' AND m.branch_name = ?';
      params.push(branch);
    }
    if (year && year !== 'all') {
      sql += ' AND m.fiscal_year = ?';
      params.push(parseInt(year));
    }
    if (type && type !== 'all') {
      sql += ' AND m.project_type = ?';
      params.push(parseInt(type));
    }

    sql += ' ORDER BY m.fiscal_year DESC, m.month_number ASC;';
    
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
    const [project] = await db.query('SELECT * FROM projects WHERE project_code = ? AND project_code NOT LIKE \'PWA6-%\' AND project_type IN (1, 2, 3, 4);', [project_code]);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found or not matching criteria' });
    }

    // ดึงข้อมูลการประมวลผลรายปี
    const performance = await db.query(
      'SELECT * FROM project_yearly_performance WHERE project_code = ? AND project_code NOT LIKE \'PWA6-%\' ORDER BY fiscal_year ASC;',
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
    const [project] = await db.query('SELECT contract_no, project_name, completed_date, start_year, project_type, completion_year FROM projects WHERE project_code = ? AND project_code NOT LIKE \'PWA6-%\' AND project_type IN (1, 2, 3, 4);', [project_code]);
    
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
      LEFT JOIN customer c ON pc.custcode = c.cus_code
      JOIN projects p ON p.contract_no != '' AND (
        (pc.project_no_proj IS NOT NULL AND pc.project_no_proj = p.contract_no)
        OR
        (pc.project_no_pipe IS NOT NULL AND pc.project_no_pipe = p.contract_no)
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
        // โครงการประเภท 4 (วางท่อเข้าซอย): ประเมินผล 1 ปี (เฉพาะปีที่แล้วเสร็จ)
        return year === compYear;
      } else {
        // โครงการประเภท 1, 2, 3 (งบปกติ): ประเมินผลสะสม 5 ปี (ปี 0 ถึง 5)
        return year >= compYear && year <= compYear + 5;
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
      JOIN customer c ON pc.custcode = c.cus_code
      JOIN projects p ON p.contract_no != '' AND (
        (pc.project_no_proj IS NOT NULL AND pc.project_no_proj = p.contract_no)
        OR
        (pc.project_no_pipe IS NOT NULL AND pc.project_no_pipe = p.contract_no)
      )
      WHERE c.LATITUDE IS NOT NULL 
        AND c.LATITUDE != ''
        AND c.LONGITUDE IS NOT NULL 
        AND c.LONGITUDE != ''
        AND p.project_code NOT LIKE 'PWA6-%'
        AND p.project_type IN (1, 2, 3, 4)
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
        // โครงการประเภท 4 (วางท่อเข้าซอย): ประเมินผล 1 ปี (เฉพาะปีที่แล้วเสร็จ)
        return year === compYear;
      } else {
        // โครงการประเภท 1, 2, 3 (งบปกติ): ประเมินผลสะสม 5 ปี (ปี 0 ถึง 5)
        return year >= compYear && year <= compYear + 5;
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
    const [project] = await db.query('SELECT project_type, start_year FROM projects WHERE project_code = ? AND project_code NOT LIKE \'PWA6-%\' AND project_type IN (1, 2, 3, 4);', [project_code]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // ตรวจสอบความซ้ำซ้อนของเลขที่สัญญา (ยกเว้นโครงการเดิมของตนเอง และข้ามการเช็กกรณีเว้นว่าง)
    if (contract_no && contract_no.trim() !== '') {
      const duplicate = await db.query(
        "SELECT project_code, project_name FROM projects WHERE TRIM(contract_no) = ? AND project_code != ? AND project_code NOT LIKE 'PWA6-%';",
        [contract_no.trim(), project_code]
      );
      if (duplicate && duplicate.length > 0) {
        return res.status(400).json({ 
          error: `เลขที่สัญญานี้ถูกใช้งานแล้วในโครงการ: ${duplicate[0].project_name} (รหัสโครงการ: ${duplicate[0].project_code})` 
        });
      }
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
      JOIN customer c ON pc.custcode = c.cus_code
      WHERE c.LATITUDE IS NOT NULL AND c.LATITUDE != '' AND c.LATITUDE != '0'
        AND c.LONGITUDE IS NOT NULL AND c.LONGITUDE != '' AND c.LONGITUDE != '0'
        AND (pc.project_no_proj = ? OR pc.project_no_pipe = ?);
    `, [contract_no.trim(), contract_no.trim()]);
    
    let updatedLatitude = null;
    let updatedLongitude = null;
    let coordStatus = 'NOT_FOUND';

    if (coords && coords.avg_lat !== null && coords.avg_lat !== undefined) {
      const lat = parseFloat(coords.avg_lat);
      const lng = parseFloat(coords.avg_lng);
      
      // ตรวจสอบพิกัดว่าอยู่ในพื้นที่รับผิดชอบ กปภ.ข.6 หรือไม่ (ภาคอีสานตอนกลาง: ขอนแก่น, ชัยภูมิ, เลย, กาฬสินธุ์, มหาสารคาม, ร้อยเอ็ด, หนองบัวลำภู)
      const isLatValid = lat >= 15.0 && lat <= 18.0;
      const isLngValid = lng >= 101.0 && lng <= 105.0;
      
      if (isLatValid && isLngValid) {
        coordStatus = 'VALID';
      } else {
        coordStatus = 'OUT_OF_BOUNDS';
      }
      
      updatedLatitude = lat;
      updatedLongitude = lng;

      await db.query(
        'UPDATE projects SET latitude = ?, longitude = ? WHERE project_code = ?;',
        [lat, lng, project_code]
      );
    } else {
      // เคลียร์ค่าพิกัดเป็น NULL หากไม่พบตำแหน่งผู้ใช้น้ำ หรือเลขที่สัญญาเป็นค่าว่าง
      await db.query(
        'UPDATE projects SET latitude = NULL, longitude = NULL WHERE project_code = ?;',
        [project_code]
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
      WHERE (pc.project_no_proj = ? OR pc.project_no_pipe = ?) AND pc.yearinstall IS NOT NULL AND pc.yearinstall != '';
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

      // Calculate fiscal year based on bgnDate instead of c.yearinstall
      let year = 0;
      if (bgnDate) {
        year = bgnDate.month >= 10 ? bgnDate.year + 1 : bgnDate.year;
      } else {
        year = parseInt(row.yearinstall || 0);
      }
      if (isNaN(year) || year === 0) return;

      // Determine month of connection (use bgnDate if available, otherwise contrac_date)
      let month = 10;
      if (bgnDate) {
        month = bgnDate.month;
      } else if (row.contrac_date && row.contrac_date.length >= 4) {
        const mVal = parseInt(row.contrac_date.substring(2, 4), 10);
        if (!isNaN(mVal) && mVal >= 1 && mVal <= 12) {
          month = mVal;
        }
      }

      // Only include if the connection has actually occurred (not in the future)
      const now = new Date();
      const curMonth = now.getMonth() + 1; // 1-12
      const curYearBE = now.getFullYear() + 543;
      const curFiscalYear = curMonth >= 10 ? curYearBE + 1 : curYearBE;
      const curFiscalIndex = curMonth >= 10 ? curMonth - 10 : curMonth + 2;

      let isFuture = false;
      if (year > curFiscalYear) {
        isFuture = true;
      } else if (year === curFiscalYear) {
        const itemFiscalIndex = month >= 10 ? month - 10 : month + 2;
        if (itemFiscalIndex > curFiscalIndex) {
          isFuture = true;
        }
      }
      if (isFuture) {
        return; // skip future connection
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
            // แก้ไขข้อผิดพลาดเดิม: จากเดิมดึงเอาปีประเมินที่ 5 และทุกปีหลังจากนั้น (>= completionYear + 5) มารวมกัน
            // เปลี่ยนเป็นคัดเลือกเอาเฉพาะปีประเมินที่ 5 (completionYear + 5) เท่านั้น ไม่นำข้อมูลปีที่ 6 เป็นต้นไปมาคำนวณ เพื่อให้สอดคล้องกับกรอบเวลา 5 ปี
            if (yr === completionYear + 5) {
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
      // ตรวจสอบเงื่อนไขกรอบเวลาประเมิน: ประเภท 4 = 1 ปี, ประเภท 1-3 = สะสม 5 ปี (ปี 0 ถึง 5)
      let isValidYear = (projectType === 4) 
        ? (yr === completionYear) 
        : (yr >= completionYear && yr <= completionYear + 5);
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

    await logSystemAction(req, req.user, 'UPDATE_CONTRACT', 'PROJECTS', project_code, { contract_no, completed_date });
    res.json({ 
      message: 'Project details and statistics updated successfully', 
      project_code, 
      contract_no, 
      completed_date,
      latitude: updatedLatitude,
      longitude: updatedLongitude,
      coordinate_status: coordStatus
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project data', details: error.message });
  }
});

// 8. ลบโครงการ (สิทธิ์เฉพาะ admin เท่านั้น)
app.delete('/api/projects/:project_code', requireAdminAuth, async (req, res) => {
  try {
    const { project_code } = req.params;

    // ตรวจสอบว่าโครงการมีอยู่จริงหรือไม่
    const [project] = await db.query('SELECT project_name FROM projects WHERE project_code = ? AND project_code NOT LIKE \'PWA6-%\';', [project_code]);
    if (!project) {
      return res.status(404).json({ error: 'ไม่พบโครงการที่ต้องการลบในระบบ' });
    }

    // ลบข้อมูลที่เกี่ยวข้องตามระดับความสัมพันธ์
    await db.query('DELETE FROM project_yearly_performance WHERE project_code = ?;', [project_code]);
    await db.query('DELETE FROM monthly_actual_users WHERE project_code = ?;', [project_code]);
    await db.query('DELETE FROM eligible_customers WHERE project_code = ?;', [project_code]);
    await db.query('DELETE FROM projects WHERE project_code = ?;', [project_code]);
    await db.query('DELETE FROM plan_master WHERE proj_no = ?;', [project_code]);

    // บันทึก Audit Log ลงประวัติระบบ
    await logSystemAction(req, req.user, 'DELETE_PROJECT', 'PROJECTS', project_code, { project_name: project.project_name });

    res.json({ success: true, message: `ลบโครงการ "${project.project_name}" (รหัสโครงการ: ${project_code}) สำเร็จเรียบร้อยแล้ว` });
  } catch (error) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบโครงการ', details: error.message });
  }
});

// Helper to lookup branch BA and wwcode
const getBranchMapping = async (conn, branchName) => {
  let ba = null;
  let wwcode = null;

  try {
    // 1. Get BA from pwa_branches
    const [branchRow] = await conn.query('SELECT ba FROM pwa_branches WHERE branch_name = ? LIMIT 1;', [branchName.trim()]);
    if (branchRow && branchRow.length > 0) {
      ba = branchRow[0].ba;
    }

    // 2. Get wwcode from plan_master
    const [pmRow] = await conn.query('SELECT wwcode FROM plan_master WHERE branch = ? AND wwcode IS NOT NULL LIMIT 1;', [branchName.trim()]);
    if (pmRow && pmRow.length > 0) {
      wwcode = pmRow[0].wwcode;
    } else if (ba) {
      // Fallback: search by ba
      const [pmRowByBa] = await conn.query('SELECT wwcode FROM plan_master WHERE ba = ? AND wwcode IS NOT NULL LIMIT 1;', [ba]);
      if (pmRowByBa && pmRowByBa.length > 0) {
        wwcode = pmRowByBa[0].wwcode;
      }
    }
  } catch (err) {
    console.error('Error in getBranchMapping lookup:', err);
  }

  return { ba, wwcode };
};

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

    // ตรวจสอบความซ้ำซ้อนของเลขที่สัญญา (ข้ามการเช็กกรณีเว้นว่าง)
    if (contract_no && contract_no.trim() !== '') {
      const [duplicate] = await connection.query(
        "SELECT project_code, project_name FROM projects WHERE TRIM(contract_no) = ? AND project_code NOT LIKE 'PWA6-%';",
        [contract_no.trim()]
      );
      if (duplicate && duplicate.length > 0) {
        return res.status(400).json({ 
          error: `เลขที่สัญญานี้ถูกใช้งานแล้วในโครงการ: ${duplicate[0].project_name} (รหัสโครงการ: ${duplicate[0].project_code})` 
        });
      }
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

    // Lookup BA and wwcode
    const { ba, wwcode } = await getBranchMapping(connection, branch_name);

    // Insert into plan_master
    await connection.query(`
      INSERT INTO plan_master 
        (ba, wwcode, branch, proj_year, completed_date, proj_no, contract_no, proj_name, contract_no_gis, proj_name_gis, budget, target, type_proj)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      ba,
      wwcode,
      branch_name.trim(),
      parseInt(start_year),
      completed_date ? completed_date.trim() : null,
      project_code.trim(),
      (contract_no || '').trim(),
      project_name.trim(),
      (contract_no || '').trim(),
      project_name.trim(),
      parseFloat(budget),
      parseInt(target_users),
      String(project_type)
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
    await logSystemAction(req, req.user, 'CREATE_PROJECT', 'PROJECTS', project_code.trim(), { project_name: project_name.trim(), branch_name: branch_name.trim() });
    res.json({ message: 'สร้างโครงการใหม่สำเร็จ', project_code });

  } catch (error) {
    await connection.rollback();
    console.error('Failed to create project:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างโครงการใหม่ได้', details: error.message });
  } finally {
    connection.release();
  }
});

// 2.2 นำเข้าโครงการจำนวยมากผ่านไฟล์ CSV (Bulk Import)
app.post('/api/projects/bulk', requireWriteAuth, async (req, res) => {
  console.log(`[BULK IMPORT] Received request for ${req.body?.projects?.length || 0} projects`);
  const { projects } = req.body;
  if (!projects || !Array.isArray(projects)) {
    return res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง กรุณาส่งข้อมูลโครงการในรูปแบบอาเรย์' });
  }

  let connection;
  const inserted = [];
  const skipped = [];

  try {
    const pool = db.getPool();
    if (!pool) {
      throw new Error('ระบบฐานข้อมูลยังไม่พร้อมใช้งาน (Database pool not initialized)');
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const proj of projects) {
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
      } = proj;

      // Validate required fields
      if (!project_code || !project_name || !branch_name || !project_type || !start_year || budget === undefined || target_users === undefined) {
        skipped.push({
          project_code: project_code || 'N/A',
          reason: 'ข้อมูลจำเป็นไม่ครบถ้วน'
        });
        continue;
      }

      // Check if project code already exists
      const [existing] = await connection.query('SELECT id FROM projects WHERE project_code = ?;', [project_code.trim()]);
      if (existing && existing.length > 0) {
        skipped.push({
          project_code: project_code.trim(),
          reason: 'รหัสโครงการนี้มีอยู่แล้วในระบบ'
        });
        continue;
      }

      // ตรวจสอบความซ้ำซ้อนของเลขที่สัญญา (ข้ามการเช็กกรณีเว้นว่าง)
      if (contract_no && contract_no.trim() !== '') {
        const [duplicate] = await connection.query(
          "SELECT project_code FROM projects WHERE TRIM(contract_no) = ? AND project_code NOT LIKE 'PWA6-%';",
          [contract_no.trim()]
        );
        if (duplicate && duplicate.length > 0) {
          skipped.push({
            project_code: project_code.trim(),
            reason: `เลขที่สัญญา '${contract_no.trim()}' ถูกใช้งานแล้วในระบบ (รหัสโครงการ: ${duplicate[0].project_code})`
          });
          continue;
        }
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

      // Lookup BA and wwcode
      const { ba: bulkBa, wwcode: bulkWwcode } = await getBranchMapping(connection, branch_name);

      // Insert into plan_master
      await connection.query(`
        INSERT INTO plan_master 
          (ba, wwcode, branch, proj_year, completed_date, proj_no, contract_no, proj_name, contract_no_gis, proj_name_gis, budget, target, type_proj)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        bulkBa,
        bulkWwcode,
        branch_name.trim(),
        parseInt(start_year),
        completed_date ? completed_date.trim() : null,
        project_code.trim(),
        (contract_no || '').trim(),
        project_name.trim(),
        (contract_no || '').trim(),
        project_name.trim(),
        parseFloat(budget),
        parseInt(target_users),
        String(project_type)
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

      inserted.push(project_code.trim());
    }

    await connection.commit();

    await logSystemAction(req, req.user, 'IMPORT_CSV', 'PROJECTS', null, { 
      insertedCount: inserted.length, 
      skippedCount: skipped.length,
      inserted,
      skipped 
    });

    // Trigger update_data.js in background to update installations and actual stats
    if (inserted.length > 0) {
      console.log(`[BULK IMPORT] Successfully committed ${inserted.length} projects. Running update_data.js in the background...`);
      exec('node update_data.js', { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[BULK IMPORT ERROR] failed to run update_data.js: ${error}`);
          return;
        }
        console.log(`[BULK IMPORT SUCCESS] update_data.js output:\n${stdout}`);
      });
    }

    res.json({
      success: true,
      message: `นำเข้าข้อมูลเสร็จสิ้น สำเร็จ ${inserted.length} โครงการ, ข้าม ${skipped.length} โครงการ`,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      inserted,
      skipped
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Failed bulk project import:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูลแบบกลุ่ม', details: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// ดึงข้อมูลวิเคราะห์ประเมินการใช้น้ำ (Water Consumption Analysis)
app.get('/api/water-usage/summary', async (req, res) => {
  try {
    const { branch, year, type } = req.query;

    // Build filter parts
    // เพิ่มการกรองข้อมูลการใช้น้ำ (debt_trn) ให้ตรงตามเงื่อนไขกรอบเวลาการประเมินโครงการ (ประเภท 4 = 1 ปี, ประเภท 1-3 = 5 ปี)
    // โดยคำนวณช่วงของปีงบประมาณตรงกับโครงสร้างข้อมูลเพื่อประสิทธิภาพสูงสุด (หลีกเลี่ยงการทำ CAST/SUBSTRING บนตารางใหญ่)
    let whereClauses = [
      `((p.project_type = 4 AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year, '09')) 
        OR 
        (p.project_type IN (1, 2, 3) AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year + 5, '09')))`
    ];
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
      whereClauses.push('p.completion_year = ?');
      params.push(parseInt(year));
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // 1. Query Total Users (นับจำนวนคนที่ไม่ซ้ำในรอบบิล)
    const metricsPromise = db.query(`
      SELECT COUNT(DISTINCT dt.cust_code) as total_users
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
    `, params);

    // 2. Query Raw Grouped Data (ดึงข้อมูลสถิติที่จัดกลุ่มเพื่อนำไปรวมค่าใน JavaScript แทนการยิงคิวรีหลายรอบ)
    const groupedPromise = db.query(`
      SELECT 
        p.project_code,
        p.contract_no,
        p.project_name,
        p.project_type,
        p.branch_name,
        COALESCE(p.budget, 0.00) as budget,
        dt.debt_ym,
        COUNT(dt.id) as total_bills,
        COALESCE(SUM(dt.present_water_usg), 0) as total_usage,
        COALESCE(SUM(dt.total_water_amt), 0) as total_amount
      FROM debt_trn dt
      JOIN eligible_customers ec ON dt.cust_code = ec.custcode
      JOIN projects p ON ec.project_code = p.project_code
      ${whereSql}
      GROUP BY p.project_code, p.contract_no, p.project_name, p.project_type, p.branch_name, p.budget, dt.debt_ym
    `, params);

    const [metricsResult, rawData] = await Promise.all([
      metricsPromise,
      groupedPromise
    ]);

    // ยุบรวมกลุ่มข้อมูลในหน่วยความจำ (In-Memory Aggregation)
    const total_users = parseInt(metricsResult[0]?.total_users || 0);
    let total_bills = 0;
    let total_usage = 0;
    let total_amount = 0.0;

    const monthlyMap = {};
    const yearlyMap = {};
    const branchMap = {};
    const projectMap = {};

    rawData.forEach(row => {
      const usage = parseInt(row.total_usage || 0);
      const amount = parseFloat(row.total_amount || 0);
      const bills = parseInt(row.total_bills || 0);

      total_bills += bills;
      total_usage += usage;
      total_amount += amount;

      // รายเดือน (Monthly)
      const monthNum = row.debt_ym.substring(4, 6);
      if (!monthlyMap[monthNum]) {
        monthlyMap[monthNum] = { total_usage: 0, total_amount: 0.0 };
      }
      monthlyMap[monthNum].total_usage += usage;
      monthlyMap[monthNum].total_amount += amount;

      // รายปีงบประมาณ (Yearly)
      const yearPart = parseInt(row.debt_ym.substring(0, 4));
      const monthPart = parseInt(monthNum);
      const fiscalYear = yearPart + (monthPart >= 10 ? 1 : 0);
      if (!yearlyMap[fiscalYear]) {
        yearlyMap[fiscalYear] = { total_usage: 0, total_amount: 0.0 };
      }
      yearlyMap[fiscalYear].total_usage += usage;
      yearlyMap[fiscalYear].total_amount += amount;

      // รายสาขา (Branch)
      const branchName = row.branch_name;
      if (!branchMap[branchName]) {
        branchMap[branchName] = { total_usage: 0, total_amount: 0.0 };
      }
      branchMap[branchName].total_usage += usage;
      branchMap[branchName].total_amount += amount;

      // รายโครงการ (Project)
      const projCode = row.project_code;
      if (!projectMap[projCode]) {
        projectMap[projCode] = {
          project_code: projCode,
          contract_no: row.contract_no,
          project_name: row.project_name,
          project_type: parseInt(row.project_type),
          branch_name: branchName,
          budget: parseFloat(row.budget),
          total_usage: 0,
          total_amount: 0.0
        };
      }
      projectMap[projCode].total_usage += usage;
      projectMap[projCode].total_amount += amount;
    });

    // แปลงผลลัพธ์รายเดือนเรียงตามปีงบประมาณไทย (เริ่ม ต.ค. สิ้นสุด ก.ย.)
    const MONTH_MAP_TH = {
      '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.', 
      '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.', '05': 'พ.ค.', '06': 'มิ.ย.',
      '07': 'ก.ค.', '08': 'ส.ค.', '09': 'ก.ย.'
    };
    const fiscalMonthsOrder = ['10', '11', '12', '01', '02', '03', '04', '05', '06', '07', '08', '09'];

    const monthlyResultFormatted = fiscalMonthsOrder.map(mNum => {
      const data = monthlyMap[mNum] || { total_usage: 0, total_amount: 0.0 };
      return {
        month_num: mNum,
        month_name: MONTH_MAP_TH[mNum],
        total_usage: data.total_usage,
        total_amount: data.total_amount
      };
    });

    // แปลงผลลัพธ์รายปี
    const yearlyResultFormatted = Object.keys(yearlyMap)
      .map(y => ({
        fiscal_year: parseInt(y),
        total_usage: yearlyMap[y].total_usage,
        total_amount: yearlyMap[y].total_amount
      }))
      .sort((a, b) => b.fiscal_year - a.fiscal_year);

    // แปลงผลลัพธ์รายสาขา
    const branchResultFormatted = Object.keys(branchMap)
      .map(b => ({
        branch_name: b,
        total_usage: branchMap[b].total_usage,
        total_amount: branchMap[b].total_amount
      }))
      .sort((a, b) => b.total_usage - a.total_usage);

    // แปลงผลลัพธ์รายโครงการ
    const projectResultFormatted = Object.values(projectMap)
      .sort((a, b) => b.total_usage - a.total_usage);

    res.json({
      metrics: {
        total_users,
        total_bills,
        total_usage,
        total_amount
      },
      monthly: monthlyResultFormatted,
      yearly: yearlyResultFormatted,
      branches: branchResultFormatted,
      projects: projectResultFormatted
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

    // เพิ่มการกรองข้อมูลการใช้น้ำ (debt_trn) ให้ตรงตามเงื่อนไขกรอบเวลาการประเมินโครงการ (ประเภท 4 = 1 ปี, ประเภท 1-3 = 5 ปี)
    let whereClauses = [
      `((p.project_type = 4 AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year, '09')) 
        OR 
        (p.project_type IN (1, 2, 3) AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year + 5, '09')))`
    ];
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
      whereClauses.push('p.completion_year = ?');
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
      LEFT JOIN customer c ON ec.custcode = c.cus_code
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
      JOIN projects p ON ec.project_code = p.project_code
      LEFT JOIN customer c ON ec.custcode = c.cus_code
      LEFT JOIN debt_trn dt ON ec.custcode = dt.cust_code AND (
        (p.project_type = 4 AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year, '09'))
        OR
        (p.project_type IN (1, 2, 3) AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10') AND dt.debt_ym <= CONCAT(p.completion_year + 5, '09'))
      )
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
// รันอัปเดตข้อมูลดิบอัตโนมัติทุกวันเวลาตีสอง (02:00)
cron.schedule('0 2 * * *', () => {
  console.log(`\n[CRON ${new Date().toISOString()}] เริ่มต้นรันสคริปต์อัปเดตข้อมูลอัตโนมัติ (update_data.js)...`);
  exec('node update_data.js', { cwd: __dirname }, (error, stdout, stderr) => {
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
