const express = require('express');
const cors = require('cors');
const db = require('./db');
const cron = require('node-cron');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { logSystemAction, logSystemActionWithConnection } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required when NODE_ENV=production. Set it before starting the server.');
  }

  console.warn('WARNING: JWT_SECRET is not set. Using an ephemeral secret for this process; sessions will be invalid after restart.');
  return crypto.randomBytes(64).toString('hex');
})();
const isSafeLocalMode = () => db.isSafeLocalMode();
const isSchemaInitEnabled = () => db.isSchemaInitEnabled();
const isCronEnabled = () => process.env.ENABLE_CRON === 'true';
const isAdmin = (user) => user?.role?.toLowerCase() === 'admin';
const normalizeArea = (area) => area === undefined || area === null ? null : String(area).replace(/\D/g, '');
const SYSTEM_ROLES = new Set(['admin', 'regadmin', 'planning', 'user', 'other']);
const PROJECT_WRITE_ROLES = new Set(['admin', 'regadmin', 'planning']);
const sanitizeContractNo = (value) => {
  const compact = String(value ?? '').replace(/\s+/gu, '');
  return compact === '0' ? '' : compact;
};
const findContractNoConflict = async (connection, contractNo, excludedProjectCode = null) => {
  const sanitizedContractNo = sanitizeContractNo(contractNo);
  if (!sanitizedContractNo) return null;

  const params = [sanitizedContractNo];
  let sql = `
    SELECT project_code, project_name, branch_name, contract_no
    FROM projects
    WHERE contract_no_normalized = ?
  `;
  if (excludedProjectCode) {
    sql += ' AND project_code <> ?';
    params.push(excludedProjectCode);
  }
  sql += ' ORDER BY project_code LIMIT 1';

  const [rows] = await connection.query(sql, params);
  return rows[0] || null;
};
const sendContractNoConflict = (res, contractNo, conflict = null) => {
  const sanitizedContractNo = sanitizeContractNo(contractNo);
  const conflictDetail = conflict
    ? ` โครงการที่ใช้เลขนี้อยู่: ${conflict.project_name} (รหัสโครงการ: ${conflict.project_code}, สาขา: ${conflict.branch_name || '-'})`
    : '';
  const message = `ไม่สามารถบันทึกเลขที่สัญญา "${sanitizedContractNo}" ได้ เนื่องจากมีโครงการอื่นใช้เลขที่สัญญานี้แล้ว${conflictDetail} กรุณาตรวจสอบหรือกรอกเลขที่สัญญาอื่น`;
  return res.status(409).json({
    success: false,
    code: 'CONTRACT_NO_ALREADY_USED',
    message,
    error: message,
    conflict: conflict ? {
      project_code: conflict.project_code,
      project_name: conflict.project_name,
      branch_name: conflict.branch_name,
      contract_no: conflict.contract_no
    } : null
  });
};
const sendProjectCodeConflict = (res, projectCode, conflict = null) => {
  const detail = conflict?.project_name ? ` โดยโครงการ "${conflict.project_name}"` : '';
  const message = `ไม่สามารถบันทึกได้ เนื่องจากรหัสโครงการ "${projectCode}" มีอยู่แล้วในระบบ${detail} กรุณาตรวจสอบรหัสโครงการ`;
  return res.status(409).json({
    success: false,
    code: 'PROJECT_CODE_ALREADY_USED',
    message,
    error: message,
    conflict: conflict || null
  });
};
const isContractNoDuplicateError = (error) => error?.code === 'ER_DUP_ENTRY'
  && String(error.message || '').includes('uq_projects_contract_no_normalized');
const isProjectCodeDuplicateError = (error) => error?.code === 'ER_DUP_ENTRY'
  && String(error.message || '').includes('project_code');
const blockSafeLocalWrite = (req, res, next) => {
  if (isSafeLocalMode()) {
    return res.status(403).json({
      success: false,
      error: 'SAFE_LOCAL_MODE is enabled: this local environment is read-only'
    });
  }
  next();
};

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Authentication Middleware (Cookie-based)
const authenticateToken = async (req, res, next) => {
  const token = req.cookies.pwa_auth_session;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    const [currentUser] = await db.query(`
      SELECT u.id, u.local_username, u.pwa_username, u.firstname, u.lastname,
             u.position, u.level_name, u.area, u.is_active, u.role AS legacy_role,
             r.name AS actual_role, r.is_active AS role_is_active
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ?
      LIMIT 1
    `, [verified.id]);

    if (!currentUser || !currentUser.is_active || currentUser.role_is_active === 0) {
      return res.status(401).json({ error: 'Account is inactive or no longer available.' });
    }

    const role = currentUser.actual_role || currentUser.legacy_role;
    if (!role || !SYSTEM_ROLES.has(role.toLowerCase())) {
      return res.status(403).json({ error: 'Account has no active role.' });
    }

    req.user = {
      ...verified,
      id: currentUser.id,
      username: currentUser.local_username || currentUser.pwa_username,
      fullName: `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim() || currentUser.local_username || currentUser.pwa_username,
      firstname: currentUser.firstname,
      lastname: currentUser.lastname,
      position: currentUser.position,
      level_name: currentUser.level_name,
      area: normalizeArea(currentUser.area),
      role
    };
    next();
  } catch (error) {
    console.error('Authentication check failed:', error.message);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const requireAdminAuth = (req, res, next) => {
  const role = req.user?.role?.toLowerCase();
  if (role === 'admin' || role === 'regadmin') return next();
  return res.status(403).json({ error: 'Access denied. User management permission required.' });
};

const requireWriteAuth = (req, res, next) => {
  if (PROJECT_WRITE_ROLES.has(req.user?.role?.toLowerCase())) return next();
  return res.status(403).json({ error: 'Access denied. Project write permission required.' });
};

const requireEarlyReportAuth = (req, res, next) => {
  if (PROJECT_WRITE_ROLES.has(req.user?.role?.toLowerCase())) return next();
  return res.status(403).json({ error: 'Access denied. Early customer report permission required.' });
};

const addProjectAreaScope = (req, whereClauses, params, projectAlias = 'p') => {
  if (isAdmin(req.user)) return;
  if (!req.user?.area) {
    whereClauses.push('1 = 0');
    return;
  }
  whereClauses.push(`EXISTS (
    SELECT 1 FROM pwa_branches area_branch
    WHERE area_branch.pwa_code = ${projectAlias}.pwa_code AND area_branch.zone = ?
  )`);
  params.push(req.user.area);
};

const ensureProjectAreaAccess = async (req, res, projectCode) => {
  const [project] = await db.query(`
    SELECT p.project_code, p.project_name, p.branch_name, p.pwa_code
    FROM projects p
    WHERE p.project_code = ?
    LIMIT 1
  `, [projectCode]);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  if (!isAdmin(req.user)) {
    const [allowedBranch] = await db.query(`
      SELECT 1
      FROM pwa_branches
      WHERE pwa_code = ? AND zone = ?
      LIMIT 1
    `, [project.pwa_code, req.user?.area]);
    if (!allowedBranch) {
      res.status(403).json({ error: 'Access denied. This project is outside your assigned area.' });
      return null;
    }
  }
  return project;
};

const ensureBranchAreaAccess = async (connection, req, pwaCode, branchName) => {
  const hasPwaCode = Boolean(String(pwaCode || '').trim());
  const params = hasPwaCode
    ? [String(pwaCode).trim(), branchName]
    : [branchName];
  let sql = hasPwaCode
    ? 'SELECT pwa_code, branch_name, zone FROM pwa_branches WHERE pwa_code = ? AND branch_name = ?'
    : 'SELECT pwa_code, branch_name, zone FROM pwa_branches WHERE branch_name = ?';
  if (!isAdmin(req.user)) {
    sql += ' AND zone = ?';
    params.push(req.user?.area);
  }
  sql += ' LIMIT 1';
  const [rows] = await connection.query(sql, params);
  return rows[0] || null;
};

// All API routes require a current active account except login.
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next();
  return authenticateToken(req, res, next);
});

// Load Admin Router
const adminRouter = require('./routes/admin');
app.use('/api/admin', requireAdminAuth, adminRouter);

// --- REST APIs ENDPOINTS ---

// Auth endpoints
const logLoginFailure = async (req, username, reason) => {
  if (!isSafeLocalMode()) {
    await logSystemAction(req, { username }, 'LOGIN_FAILED', 'SYSTEM', null, { reason });
  }
};

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const { password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    let userPayload = null;
    let localAuthSuccess = false;

    // 1. Local Auth Strategy
    const [localUser] = await db.query(`
      SELECT u.*, r.name AS actual_role, r.is_active AS role_is_active
      FROM users u 
      LEFT JOIN user_roles ur ON u.id = ur.user_id 
      LEFT JOIN roles r ON ur.role_id = r.id 
      WHERE u.local_username = ? LIMIT 1
    `, [username]);
    if (localUser && localUser.password) {
      const isMatch = await bcrypt.compare(password, localUser.password);
      if (isMatch) {
        if (!localUser.is_active) {
          await logLoginFailure(req, username, 'account_inactive');
          return res.status(401).json({ success: false, error: 'Account is deactivated' });
        }
        const role = localUser.actual_role || localUser.role;
        if (!role || !SYSTEM_ROLES.has(role.toLowerCase()) || localUser.role_is_active === 0) {
          await logLoginFailure(req, username, 'role_inactive_or_invalid');
          return res.status(403).json({ success: false, error: 'Account has no active system role.' });
        }

        localAuthSuccess = true;
        if (!isSafeLocalMode()) {
          await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [localUser.id]);
        }
        userPayload = {
          id: localUser.id,
          username: localUser.local_username,
          fullName: `${localUser.firstname || ''} ${localUser.lastname || ''}`.trim() || localUser.local_username,
          firstname: localUser.firstname,
          lastname: localUser.lastname,
          position: localUser.position,
          level_name: localUser.level_name,
          area: normalizeArea(localUser.area),
          role
        };
      }
    }

    // 2. PWA Auth Strategy
    if (!localAuthSuccess) {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('pwd', password);

      let response;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        response = await fetch('https://intranet.pwa.co.th/login/webservice_login6.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
          signal: controller.signal
        });
      } catch (error) {
        console.error('PWA authentication service unavailable:', error.message);
        await logLoginFailure(req, username, error.name === 'AbortError' ? 'pwa_timeout' : 'pwa_unavailable');
        return res.status(503).json({
          success: false,
          error: 'ระบบยืนยันตัวตน PWA ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง'
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const serviceUnavailable = response.status >= 500;
        await logLoginFailure(req, username, serviceUnavailable ? 'pwa_service_error' : 'invalid_credentials');
        return res.status(serviceUnavailable ? 503 : 401).json({
          success: false,
          error: serviceUnavailable
            ? 'ระบบยืนยันตัวตน PWA ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง'
            : 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง (Local & PWA)'
        });
      } else {
        const textResult = await response.text();
        const cleanText = textResult.trim().replace(/^\(/, '').replace(/\);?$/, '');
        let intranetResult;
        try {
          intranetResult = JSON.parse(cleanText);
        } catch (error) {
          console.error('Invalid response from PWA authentication service:', error.message);
          await logLoginFailure(req, username, 'invalid_pwa_response');
          return res.status(503).json({
            success: false,
            error: 'ระบบยืนยันตัวตน PWA ส่งข้อมูลตอบกลับไม่ถูกต้อง กรุณาลองใหม่ภายหลัง'
          });
        }
        
        if (intranetResult?.status !== 'success') {
          await logLoginFailure(req, username, 'pwa_auth_rejected');
          return res.status(401).json({ success: false, error: 'ชื่อผู้ใช้งานหรือรหัสผ่านอินทราเน็ตไม่ถูกต้อง' });
        }

        const authenticatedPwaUsername = String(intranetResult.username || '').trim();
        if (!authenticatedPwaUsername) {
          await logLoginFailure(req, username, 'missing_pwa_username');
          return res.status(503).json({
            success: false,
            error: 'ระบบยืนยันตัวตน PWA ส่งข้อมูลผู้ใช้งานไม่ครบถ้วน กรุณาลองใหม่ภายหลัง'
          });
        }

        // Use the identity returned by PWA as the authoritative account key.
        const [existingPwaUser] = await db.query(`
          SELECT u.*, r.name AS actual_role, r.is_active AS role_is_active
          FROM users u 
          LEFT JOIN user_roles ur ON u.id = ur.user_id 
          LEFT JOIN roles r ON ur.role_id = r.id 
          WHERE u.pwa_username = ? LIMIT 1
        `, [authenticatedPwaUsername]);
        if (existingPwaUser) {
          if (!existingPwaUser.is_active) {
            await logLoginFailure(req, authenticatedPwaUsername, 'account_inactive');
            return res.status(401).json({ success: false, error: 'Account is deactivated' });
          }
          const userArea = intranetResult.area !== undefined ? intranetResult.area : existingPwaUser.area;
          const role = existingPwaUser.actual_role || existingPwaUser.role;
          if (!role || !SYSTEM_ROLES.has(role.toLowerCase()) || existingPwaUser.role_is_active === 0) {
            await logLoginFailure(req, authenticatedPwaUsername, 'role_inactive_or_invalid');
            return res.status(403).json({ success: false, error: 'Account has no active system role.' });
          }

          if (!isSafeLocalMode()) {
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
          }
          userPayload = {
            id: existingPwaUser.id,
            username: existingPwaUser.pwa_username,
            fullName: `${intranetResult.firstname || existingPwaUser.firstname || ''} ${intranetResult.lastname || existingPwaUser.lastname || ''}`.trim() || existingPwaUser.pwa_username,
            firstname: intranetResult.firstname || existingPwaUser.firstname,
            lastname: intranetResult.lastname || existingPwaUser.lastname,
            position: intranetResult.position || existingPwaUser.position,
            level_name: intranetResult.level || existingPwaUser.level_name,
            area: normalizeArea(userArea),
            role
          };
        } else {
          if (isSafeLocalMode()) {
            return res.status(403).json({
              success: false,
              error: 'SAFE_LOCAL_MODE is enabled: provisioning new users is not allowed.'
            });
          }

          const connection = await db.getPool().getConnection();
          const newId = uuidv4();
          try {
            await connection.beginTransaction();
            const [roleRows] = await connection.query(
              'SELECT id FROM roles WHERE name = ? AND is_active = 1 LIMIT 1',
              ['user']
            );
            const userRole = roleRows[0];
            if (!userRole) throw new Error('Default user role is missing or inactive');

            await connection.query(`
              INSERT INTO users
                (id, role, pwa_username, firstname, lastname, email, position, level_name, costcenter, ba, part, area, job_name, div_name, dep_name, org_name, is_active, last_login)
              VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)
            `, [
              newId,
              authenticatedPwaUsername,
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
            await connection.query(
              'INSERT INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)',
              [uuidv4(), newId, userRole.id]
            );

            userPayload = {
              id: newId,
              username: authenticatedPwaUsername,
              fullName: `${intranetResult.firstname || ''} ${intranetResult.lastname || ''}`.trim() || authenticatedPwaUsername,
              firstname: intranetResult.firstname || null,
              lastname: intranetResult.lastname || null,
              position: intranetResult.position || null,
              level_name: intranetResult.level || null,
              area: normalizeArea(intranetResult.area),
              role: 'user'
            };

            await logSystemActionWithConnection(
              connection,
              req,
              userPayload,
              'CREATE_PWA_USER',
              'USERS',
              newId,
              { auth_type: 'pwa' }
            );
            await connection.commit();
          } catch (error) {
            await connection.rollback();
            if (error.code === 'ER_DUP_ENTRY') {
              const [concurrentUser] = await db.query(`
                SELECT u.*, r.name AS actual_role, r.is_active AS role_is_active
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                WHERE u.pwa_username = ? LIMIT 1
              `, [authenticatedPwaUsername]);
              const concurrentRole = concurrentUser?.actual_role || concurrentUser?.role;
              if (!concurrentUser || !concurrentUser.is_active || !concurrentRole || !SYSTEM_ROLES.has(concurrentRole.toLowerCase()) || concurrentUser.role_is_active === 0) {
                throw error;
              }
              userPayload = {
                id: concurrentUser.id,
                username: concurrentUser.pwa_username,
                fullName: `${concurrentUser.firstname || ''} ${concurrentUser.lastname || ''}`.trim() || concurrentUser.pwa_username,
                firstname: concurrentUser.firstname,
                lastname: concurrentUser.lastname,
                position: concurrentUser.position,
                level_name: concurrentUser.level_name,
                area: normalizeArea(concurrentUser.area),
                role: concurrentRole
              };
            } else {
              throw error;
            }
          } finally {
            connection.release();
          }
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
    if (!isSafeLocalMode()) {
      await logSystemAction(req, userPayload, 'LOGIN_SUCCESS', 'SYSTEM', null, { auth_type: localAuthSuccess ? 'local' : 'pwa' });
    }

    res.json({
      success: true,
      data: {
        isLoggedIn: true,
        user: userPayload
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  if (req.user && !isSafeLocalMode()) {
    await logSystemAction(req, req.user, 'LOGOUT', 'SYSTEM');
  }
  res.clearCookie('pwa_auth_session', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ success: true, data: req.user });
});


// 1. ดึงรายชื่อสาขาทั้งหมด (เรียงตามเขตก่อน แล้วค่อยเรียงตาม ba)
app.get('/api/branches', async (req, res) => {
  try {
    const params = [];
    let sql = 'SELECT id, branch_name, province, ba, zone, pwa_address, longitude, latitude, pwa_code, pwa_station FROM pwa_branches';
    if (!isAdmin(req.user)) {
      sql += ' WHERE zone = ?';
      params.push(req.user.area);
    }
    sql += ' ORDER BY zone ASC, ba ASC;';
    const branches = await db.query(sql, params);
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches', details: error.message });
  }
});

// 2. ดึงรายชื่อโครงการทั้งหมด พร้อมผลรวมสะสมเป้าหมายจริงและอัตราส่วนความสำเร็จ
app.get('/api/projects', async (req, res) => {
  try {
    const whereClauses = ["p.project_code NOT LIKE 'PWA6-%'", 'p.project_type IN (1, 2, 3, 4)'];
    const params = [];
    addProjectAreaScope(req, whereClauses, params);
    const whereSql = whereClauses.join(' AND ');

    // ดึงโครงการทั้งหมด (กรองข้อมูลจริงที่ไม่ใช่ Mock data และอยู่ใน 4 ประเภทโครงการประเมินเท่านั้น)
    const projects = await db.query(`
      SELECT p.*, b.ba 
      FROM projects p
      LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code
      WHERE ${whereSql}
      ORDER BY b.ba ASC, p.project_code ASC;
    `, params);
    
    // ดึงยอดจริงสะสมของแต่ละโครงการเพื่อลดภาระการประมวลผลบน React
    const actuals = await db.query(`
      SELECT y.project_code, SUM(y.actual_users) as total_actual_users
      FROM project_yearly_performance y
      JOIN projects p ON y.project_code = p.project_code
      WHERE ${whereSql}
      GROUP BY y.project_code;
    `, params);

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
      SELECT m.*, p.contract_no, p.pwa_code 
      FROM monthly_actual_users m
      LEFT JOIN projects p ON m.project_code = p.project_code
      WHERE m.project_code NOT LIKE 'PWA6-%' AND m.project_type IN (1, 2, 3, 4)
    `;
    const params = [];
    if (!isAdmin(req.user)) {
      sql += ` AND EXISTS (
        SELECT 1 FROM pwa_branches area_branch
        WHERE area_branch.pwa_code = p.pwa_code AND area_branch.zone = ?
      )`;
      params.push(req.user.area);
    }

    if (branch && branch !== 'all') {
      sql += ' AND p.pwa_code = ?';
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

// 3.5 ดึงข้อมูลสำหรับหน้ารายงานสรุปรายโครงการ (รวมสถิติรายปีและรายเดือน)
app.get('/api/reports/project-summary', async (req, res) => {
  try {
    const whereClauses = ["p.project_code NOT LIKE 'PWA6-%'", 'p.project_type IN (1, 2, 3, 4)'];
    const params = [];
    addProjectAreaScope(req, whereClauses, params);
    const whereSql = whereClauses.join(' AND ');
    const projects = await db.query(`
      SELECT p.*, b.ba 
      FROM projects p
      LEFT JOIN pwa_branches b ON p.pwa_code = b.pwa_code
      WHERE ${whereSql}
      ORDER BY b.zone ASC, b.ba ASC, p.project_code ASC;
    `, params);
    
    const yearly = await db.query(`
      SELECT y.project_code, y.fiscal_year, y.actual_users
      FROM project_yearly_performance y
      JOIN projects p ON y.project_code = p.project_code
      WHERE ${whereSql}
    `, params);

    const monthly = await db.query(`
      SELECT m.project_code, m.fiscal_year, m.month_number, m.actual_users, m.early_users
      FROM monthly_actual_users m
      JOIN projects p ON m.project_code = p.project_code
      WHERE ${whereSql}
    `, params);

    res.json({
      success: true,
      projects,
      yearly,
      monthly
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch project summary data', details: error.message });
  }
});

// 3.8 ดึงข้อมูลการใช้น้ำรายเดือนฉบับสมบูรณ์สำหรับป๊อปอัพ Heatmap รายโครงการ
app.get('/api/project-monthly-details/:project_code', async (req, res) => {
  try {
    const { project_code } = req.params;
    if (!await ensureProjectAreaAccess(req, res, project_code)) return;
    const monthly = await db.query(
      'SELECT fiscal_year, month_number, month_name, actual_users, early_users FROM monthly_actual_users WHERE project_code = ? ORDER BY fiscal_year ASC, month_number ASC;',
      [project_code]
    );
    res.json({ success: true, monthly });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. ดึงสถิติประเมินจำนวนผู้ใช้น้ำตามเป้าหมายโครงการรายโครงการ (Deep-dive Break-even data)
app.get('/api/project-breakeven/:project_code', async (req, res) => {
  try {
    const { project_code } = req.params;
    if (!await ensureProjectAreaAccess(req, res, project_code)) return;
    
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
    if (!await ensureProjectAreaAccess(req, res, project_code)) return;
    
    // ดึงข้อมูลหลักโครงการ
    const [project] = await db.query('SELECT contract_no, project_name, completed_date, start_year, project_type, completion_year FROM projects WHERE project_code = ? AND project_code NOT LIKE \'PWA6-%\' AND project_type IN (1, 2, 3, 4);', [project_code]);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // แยก project_no_proj/project_no_pipe ด้วย UNION เพื่อให้ใช้ normalized indexes ได้ทั้งสองชุด
    // และใช้ LEFT JOIN customer เพื่อให้ดึงข้อมูลจาก proj_cus ได้แม้ไม่มีประวัติใน customer
    const customers = await db.query(`
      WITH matched_proj_cus AS (
        SELECT pc.Id
        FROM projects p
        JOIN proj_cus pc
          ON pc.project_no_proj_normalized = p.contract_no_normalized
        WHERE p.project_code = ?

        UNION

        SELECT pc.Id
        FROM projects p
        JOIN proj_cus pc
          ON pc.project_no_pipe_normalized = p.contract_no_normalized
        WHERE p.project_code = ?
      )
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
      FROM matched_proj_cus matched
      JOIN proj_cus pc ON pc.Id = matched.Id
      LEFT JOIN customer c ON pc.custcode = c.cus_code
    `, [project_code, project_code]);

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
      WITH project_customer_links AS (
        SELECT pc.Id AS proj_cus_id, p.id AS project_id
        FROM projects p
        JOIN proj_cus pc
          ON pc.project_no_proj_normalized = p.contract_no_normalized
        WHERE p.contract_no_normalized IS NOT NULL

        UNION

        SELECT pc.Id AS proj_cus_id, p.id AS project_id
        FROM projects p
        JOIN proj_cus pc
          ON pc.project_no_pipe_normalized = p.contract_no_normalized
        WHERE p.contract_no_normalized IS NOT NULL
      )
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
      FROM project_customer_links link
      JOIN proj_cus pc ON pc.Id = link.proj_cus_id
      JOIN customer c ON pc.custcode = c.cus_code
      JOIN projects p ON p.id = link.project_id
      WHERE c.LATITUDE IS NOT NULL 
        AND c.LATITUDE != ''
        AND c.LONGITUDE IS NOT NULL 
        AND c.LONGITUDE != ''
        AND p.project_code NOT LIKE 'PWA6-%'
        AND p.project_type IN (1, 2, 3, 4)
    `;
    const params = [];
    if (!isAdmin(req.user)) {
      sql += ` AND EXISTS (
        SELECT 1 FROM pwa_branches area_branch
        WHERE area_branch.pwa_code = p.pwa_code AND area_branch.zone = ?
      )`;
      params.push(req.user.area);
    }

    if (branch && branch !== 'all') {
      sql += ' AND p.pwa_code = ?';
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
app.put('/api/projects/:project_code/contract', requireWriteAuth, blockSafeLocalWrite, async (req, res) => {
  let connection;
  let sanitizedContractNo = '';
  try {
    const { project_code } = req.params;
    const { contract_no, completed_date, latitude, longitude, remarks } = req.body;

    if (!await ensureProjectAreaAccess(req, res, project_code)) return;

    if (contract_no === undefined) {
      return res.status(400).json({
        success: false,
        code: 'CONTRACT_NO_FIELD_REQUIRED',
        error: 'กรุณาส่งข้อมูลเลขที่สัญญา โดยสามารถเว้นว่างได้หากยังไม่มีเลขที่สัญญา'
      });
    }
    sanitizedContractNo = sanitizeContractNo(contract_no);

    connection = await db.getPool().getConnection();
    await connection.beginTransaction();
    const query = async (sql, params) => {
      const [rows] = await connection.query(sql, params);
      return rows;
    };

    // 1. ดึงรายละเอียดเดิมของโครงการเพื่อใช้ป้อนข้อมูลและคำนวณปีงบประมาณ
    const [project] = await query('SELECT project_type, start_year FROM projects WHERE project_code = ? AND project_code NOT LIKE \'PWA6-%\' AND project_type IN (1, 2, 3, 4);', [project_code]);
    if (!project) {
      await connection.rollback();
      return res.status(404).json({ error: 'Project not found' });
    }

    // ตรวจเลขสัญญาหลังลบช่องว่างทุกตำแหน่ง โดยอนุญาตให้ค่าว่างซ้ำได้
    const contractConflict = await findContractNoConflict(connection, sanitizedContractNo, project_code);
    if (contractConflict) {
      await connection.rollback();
      return sendContractNoConflict(res, sanitizedContractNo, contractConflict);
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

    // 3. อัปเดตข้อมูลหัวโครงการ (อัปเดตทั้งตาราง projects และ plan_master เพื่อรักษาความสอดคล้อง)
    await query(
      'UPDATE projects SET contract_no = ?, completed_date = ?, completion_year = ?, remarks = ? WHERE project_code = ?;',
      [sanitizedContractNo, completed_date ? completed_date.trim() : null, completionYear, remarks !== undefined && remarks !== null ? remarks.trim() : null, project_code]
    );

    await query(
      'UPDATE plan_master SET contract_no = ?, contract_no_gis = ?, completed_date = ?, remarks = ? WHERE proj_no = ?;',
      [sanitizedContractNo, sanitizedContractNo, completed_date ? completed_date.trim() : null, remarks !== undefined && remarks !== null ? remarks.trim() : null, project_code]
    );

    let updatedLatitude = null;
    let updatedLongitude = null;
    let coordStatus = 'NOT_FOUND';

    // If manual coordinates are provided, use them
    if (latitude !== undefined && latitude !== null && latitude !== '' && longitude !== undefined && longitude !== null && longitude !== '') {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        updatedLatitude = lat;
        updatedLongitude = lng;
        
        // ตรวจสอบพิกัดว่าอยู่ในพื้นที่รับผิดชอบ กปภ.ข.6 หรือไม่ (ภาคอีสานตอนกลาง: ขอนแก่น, ชัยภูมิ, เลย, กาฬสินธุ์, มหาสารคาม, ร้อยเอ็ด, หนองบัวลำภู)
        const isLatValid = lat >= 15.0 && lat <= 18.0;
        const isLngValid = lng >= 101.0 && lng <= 105.0;
        coordStatus = (isLatValid && isLngValid) ? 'VALID' : 'OUT_OF_BOUNDS';
        
        await query(
          'UPDATE projects SET latitude = ?, longitude = ? WHERE project_code = ?;',
          [lat, lng, project_code]
        );
      }
    } else {
      // 4. คำนวณพิกัดเฉลี่ยใหม่จากตำแหน่งผู้ใช้น้ำจริงของเลขที่สัญญานี้
      let coords = null;
      if (sanitizedContractNo) {
        [coords] = await query(`
          WITH matched_proj_cus AS (
            SELECT Id
            FROM proj_cus
            WHERE project_no_proj_normalized = ?

            UNION

            SELECT Id
            FROM proj_cus
            WHERE project_no_pipe_normalized = ?
          )
          SELECT
            AVG(CAST(c.LATITUDE AS DOUBLE)) AS avg_lat,
            AVG(CAST(c.LONGITUDE AS DOUBLE)) AS avg_lng
          FROM matched_proj_cus matched
          JOIN proj_cus pc ON pc.Id = matched.Id
          JOIN customer c ON pc.custcode = c.cus_code
          WHERE c.LATITUDE IS NOT NULL AND c.LATITUDE != '' AND c.LATITUDE != '0'
            AND c.LONGITUDE IS NOT NULL AND c.LONGITUDE != '' AND c.LONGITUDE != '0'
          ;
        `, [sanitizedContractNo, sanitizedContractNo]);
      }
      
      if (coords && coords.avg_lat !== null && coords.avg_lat !== undefined) {
        const lat = parseFloat(coords.avg_lat);
        const lng = parseFloat(coords.avg_lng);
        
        // ตรวจสอบพิกัดว่าอยู่ในพื้นที่รับผิดชอบ กปภ.ข.6 หรือไม่
        const isLatValid = lat >= 15.0 && lat <= 18.0;
        const isLngValid = lng >= 101.0 && lng <= 105.0;
        
        if (isLatValid && isLngValid) {
          coordStatus = 'VALID';
        } else {
          coordStatus = 'OUT_OF_BOUNDS';
        }
        
        updatedLatitude = lat;
        updatedLongitude = lng;

        await query(
          'UPDATE projects SET latitude = ?, longitude = ? WHERE project_code = ?;',
          [lat, lng, project_code]
        );
      } else {
        // เคลียร์ค่าพิกัดเป็น NULL หากไม่พบตำแหน่งผู้ใช้น้ำ หรือเลขที่สัญญาเป็นค่าว่าง
        await query(
          'UPDATE projects SET latitude = NULL, longitude = NULL WHERE project_code = ?;',
          [project_code]
        );
      }
    }

    // 5. ดึงข้อมูลประวัติการเชื่อมสายท่อจริงของผู้ใช้ (Installations) เพื่อคำนวณผลงานสะสม
    const rawActuals = sanitizedContractNo
      ? await query(`
          WITH matched_proj_cus AS (
            SELECT Id
            FROM proj_cus
            WHERE project_no_proj_normalized = ?

            UNION

            SELECT Id
            FROM proj_cus
            WHERE project_no_pipe_normalized = ?
          )
          SELECT
            pc.custcode,
            pc.yearinstall,
            pc.contrac_date,
            pc.bgncustdt
          FROM matched_proj_cus matched
          JOIN proj_cus pc ON pc.Id = matched.Id
          WHERE pc.yearinstall IS NOT NULL
            AND pc.yearinstall != '';
        `, [sanitizedContractNo, sanitizedContractNo])
      : [];

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
    await query('DELETE FROM project_yearly_performance WHERE project_code = ?;', [project_code]);
    await query('DELETE FROM monthly_actual_users WHERE project_code = ?;', [project_code]);
    await query('DELETE FROM eligible_customers WHERE project_code = ?;', [project_code]);

    if (eligibleCustomersRows.length > 0) {
      await query(`
        INSERT INTO eligible_customers 
          (project_code, custcode, fiscal_year, month_number)
        VALUES ?;
      `, [eligibleCustomersRows]);
    }

    const [projHeader] = await query('SELECT target_users, project_name, branch_name FROM projects WHERE project_code = ?;', [project_code]);
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
      await query(`
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
      await query(`
        INSERT INTO monthly_actual_users 
          (project_code, project_name, branch_name, project_type, fiscal_year, month_number, month_name, actual_users)
        VALUES ?;
      `, [monthlyRows]);
    }

    await logSystemActionWithConnection(connection, req, req.user, 'UPDATE_PROJECT', 'PROJECTS', project_code, { contract_no: sanitizedContractNo, completed_date });
    await connection.commit();
    res.json({ 
      message: 'Project details and statistics updated successfully', 
      project_code, 
      contract_no: sanitizedContractNo,
      completed_date,
      latitude: updatedLatitude,
      longitude: updatedLongitude,
      coordinate_status: coordStatus
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (isContractNoDuplicateError(error)) {
      let conflict = null;
      try {
        conflict = connection
          ? await findContractNoConflict(connection, sanitizedContractNo, req.params.project_code)
          : null;
      } catch (lookupError) {
        console.error('Failed to lookup concurrent contract conflict:', lookupError.message);
      }
      return sendContractNoConflict(res, sanitizedContractNo, conflict);
    }
    res.status(500).json({ error: 'Failed to update project data', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 8. ลบโครงการ (Admin ทุกเขต, RegAdmin/Planning เฉพาะเขตตนเอง)
app.delete('/api/projects/:project_code', requireWriteAuth, blockSafeLocalWrite, async (req, res) => {
  let connection;
  try {
    const { project_code } = req.params;

    if (!await ensureProjectAreaAccess(req, res, project_code)) return;

    connection = await db.getPool().getConnection();
    await connection.beginTransaction();
    const query = async (sql, params) => {
      const [rows] = await connection.query(sql, params);
      return rows;
    };

    // ตรวจสอบว่าโครงการมีอยู่จริงหรือไม่
    const [project] = await query('SELECT project_name, branch_name FROM projects WHERE project_code = ? AND project_code NOT LIKE \'PWA6-%\';', [project_code]);
    if (!project) {
      await connection.rollback();
      return res.status(404).json({ error: 'ไม่พบโครงการที่ต้องการลบในระบบ' });
    }

    // ลบข้อมูลที่เกี่ยวข้องตามระดับความสัมพันธ์
    await query('DELETE FROM project_yearly_performance WHERE project_code = ?;', [project_code]);
    await query('DELETE FROM monthly_actual_users WHERE project_code = ?;', [project_code]);
    await query('DELETE FROM eligible_customers WHERE project_code = ?;', [project_code]);
    await query('DELETE FROM projects WHERE project_code = ?;', [project_code]);
    await query('DELETE FROM plan_master WHERE proj_no = ?;', [project_code]);

    // บันทึก Audit Log ลงประวัติระบบ
    await logSystemActionWithConnection(connection, req, req.user, 'DELETE_PROJECT', 'PROJECTS', project_code, { project_name: project.project_name });
    await connection.commit();

    res.json({ success: true, message: `ลบโครงการ "${project.project_name}" (รหัสโครงการ: ${project_code}) สำเร็จเรียบร้อยแล้ว` });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบโครงการ', details: error.message });
  } finally {
    if (connection) connection.release();
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
app.post('/api/projects', requireWriteAuth, blockSafeLocalWrite, async (req, res) => {
  const connection = await db.getPool().getConnection();
  let sanitizedContractNo = '';
  let sanitizedProjectCode = '';
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
      longitude,
      remarks,
      pwa_code
    } = req.body;

    if (!project_code || !project_name || !branch_name || !project_type || !start_year || budget === undefined || target_users === undefined) {
      await connection.rollback();
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }
    sanitizedProjectCode = project_code.trim();
    sanitizedContractNo = sanitizeContractNo(contract_no);

    const selectedBranch = await ensureBranchAreaAccess(connection, req, pwa_code, branch_name.trim());
    if (!selectedBranch) {
      await connection.rollback();
      return res.status(403).json({ error: 'Access denied or branch information does not match your assigned area.' });
    }
    const effectivePwaCode = selectedBranch.pwa_code;

    // Check if project code already exists
    const [existing] = await connection.query(
      'SELECT project_code, project_name, branch_name FROM projects WHERE project_code = ? LIMIT 1;',
      [sanitizedProjectCode]
    );
    if (existing && existing.length > 0) {
      await connection.rollback();
      return sendProjectCodeConflict(res, sanitizedProjectCode, existing[0]);
    }

    const contractConflict = await findContractNoConflict(connection, sanitizedContractNo);
    if (contractConflict) {
      await connection.rollback();
      return sendContractNoConflict(res, sanitizedContractNo, contractConflict);
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
        (project_code, contract_no, branch_name, pwa_code, project_name, project_type, start_year, completion_year, completed_date, budget, target_users, latitude, longitude, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      sanitizedProjectCode,
      sanitizedContractNo,
      branch_name.trim(),
      effectivePwaCode,
      project_name.trim(),
      parseInt(project_type),
      parseInt(start_year),
      completionYear,
      completed_date ? completed_date.trim() : null,
      parseFloat(budget),
      parseInt(target_users),
      latitude && latitude !== '' ? parseFloat(latitude) : null,
      longitude && longitude !== '' ? parseFloat(longitude) : null,
      remarks !== undefined && remarks !== null ? remarks.trim() : null
    ]);

    // Lookup BA and wwcode
    const { ba, wwcode } = await getBranchMapping(connection, branch_name);

    // Insert into plan_master
    await connection.query(`
      INSERT INTO plan_master 
        (ba, wwcode, branch, proj_year, completed_date, proj_no, contract_no, proj_name, contract_no_gis, proj_name_gis, budget, target, type_proj, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      ba,
      wwcode,
      branch_name.trim(),
      parseInt(start_year),
      completed_date ? completed_date.trim() : null,
      sanitizedProjectCode,
      sanitizedContractNo,
      project_name.trim(),
      sanitizedContractNo,
      project_name.trim(),
      parseFloat(budget),
      parseInt(target_users),
      String(project_type),
      remarks !== undefined && remarks !== null ? remarks.trim() : null
    ]);

    // Generate yearly performance records based on type
    const pType = parseInt(project_type);
    const cYear = completionYear;
    const tUsers = parseInt(target_users);

    const performanceRows = [];
    if (pType === 4) {
      performanceRows.push([
        sanitizedProjectCode,
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
          sanitizedProjectCode,
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

    await logSystemActionWithConnection(connection, req, req.user, 'CREATE_PROJECT', 'PROJECTS', sanitizedProjectCode, {
      project_name: project_name.trim(),
      branch_name: branch_name.trim(),
      contract_no: sanitizedContractNo
    });
    await connection.commit();
    res.json({ message: 'สร้างโครงการใหม่สำเร็จ', project_code: sanitizedProjectCode, contract_no: sanitizedContractNo });

  } catch (error) {
    await connection.rollback();
    console.error('Failed to create project:', error);
    if (isContractNoDuplicateError(error)) {
      let conflict = null;
      try {
        conflict = await findContractNoConflict(connection, sanitizedContractNo);
      } catch (lookupError) {
        console.error('Failed to lookup concurrent contract conflict:', lookupError.message);
      }
      return sendContractNoConflict(res, sanitizedContractNo, conflict);
    }
    if (isProjectCodeDuplicateError(error)) {
      return sendProjectCodeConflict(res, sanitizedProjectCode);
    }
    res.status(500).json({ error: 'ไม่สามารถสร้างโครงการใหม่ได้', details: error.message });
  } finally {
    connection.release();
  }
});

// 2.2 นำเข้าโครงการจำนวยมากผ่านไฟล์ CSV (Bulk Import)
app.post('/api/projects/bulk', requireWriteAuth, blockSafeLocalWrite, async (req, res) => {
  console.log(`[BULK IMPORT] Received request for ${req.body?.projects?.length || 0} projects`);
  const { projects, file_name } = req.body;
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

    // Duplicate preflight is all-or-nothing so a CSV never creates a partial batch because of conflicts.
    const conflicts = [];
    const seenProjectCodes = new Map();
    const seenContractNos = new Map();
    for (const proj of projects) {
      const projectCode = String(proj.project_code || '').trim();
      const contractNo = sanitizeContractNo(proj.contract_no);

      if (projectCode) {
        if (seenProjectCodes.has(projectCode)) {
          conflicts.push({
            type: 'project_code',
            project_code: projectCode,
            message: `รหัสโครงการ "${projectCode}" ซ้ำกันภายในไฟล์`
          });
        } else {
          seenProjectCodes.set(projectCode, true);
          const [existingProjects] = await connection.query(
            'SELECT project_code, project_name, branch_name FROM projects WHERE project_code = ? LIMIT 1',
            [projectCode]
          );
          if (existingProjects.length > 0) {
            conflicts.push({
              type: 'project_code',
              project_code: projectCode,
              existing_project: existingProjects[0],
              message: `รหัสโครงการ "${projectCode}" มีอยู่แล้วในระบบ`
            });
          }
        }
      }

      if (contractNo) {
        if (seenContractNos.has(contractNo)) {
          conflicts.push({
            type: 'contract_no',
            project_code: projectCode,
            contract_no: contractNo,
            conflicting_project_code: seenContractNos.get(contractNo),
            message: `เลขที่สัญญา "${contractNo}" ซ้ำกันภายในไฟล์`
          });
        } else {
          seenContractNos.set(contractNo, projectCode);
          const conflict = await findContractNoConflict(connection, contractNo);
          if (conflict) {
            conflicts.push({
              type: 'contract_no',
              project_code: projectCode,
              contract_no: contractNo,
              existing_project: conflict,
              message: `เลขที่สัญญา "${contractNo}" ถูกใช้โดยโครงการ ${conflict.project_code} (${conflict.project_name}) แล้ว`
            });
          }
        }
      }
    }

    if (conflicts.length > 0) {
      await connection.rollback();
      const message = `ไม่สามารถนำเข้าไฟล์ได้ เนื่องจากพบข้อมูลซ้ำ ${conflicts.length} รายการ กรุณาแก้ไขข้อมูลที่แจ้งแล้วนำเข้าใหม่อีกครั้ง`;
      return res.status(409).json({
        success: false,
        code: 'BULK_IMPORT_DUPLICATES',
        message,
        error: message,
        conflicts
      });
    }

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
        longitude,
        pwa_code
      } = proj;
      const sanitizedProjectCode = String(project_code || '').trim();
      const sanitizedContractNo = sanitizeContractNo(contract_no);

      // Validate required fields
      if (!project_code || !project_name || !branch_name || !project_type || !start_year || budget === undefined || target_users === undefined) {
        skipped.push({
          project_code: project_code || 'N/A',
          reason: 'ข้อมูลจำเป็นไม่ครบถ้วน'
        });
        continue;
      }

      const selectedBranch = await ensureBranchAreaAccess(connection, req, pwa_code, branch_name.trim());
      if (!selectedBranch) {
        skipped.push({
          project_code: project_code || 'N/A',
          reason: `ไม่มีสิทธิ์นำเข้า หรือข้อมูลสาขาไม่ตรงกับรหัสสาขา (${branch_name})`
        });
        continue;
      }
      const effectivePwaCode = selectedBranch.pwa_code;

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
          (project_code, contract_no, branch_name, pwa_code, project_name, project_type, start_year, completion_year, completed_date, budget, target_users, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        sanitizedProjectCode,
        sanitizedContractNo,
        branch_name.trim(),
        effectivePwaCode,
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
        sanitizedProjectCode,
        sanitizedContractNo,
        project_name.trim(),
        sanitizedContractNo,
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
          sanitizedProjectCode,
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
              sanitizedProjectCode,
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

      inserted.push(sanitizedProjectCode);
    }

    await logSystemActionWithConnection(connection, req, req.user, 'IMPORT_CSV', 'PROJECTS', null, {
      insertedCount: inserted.length, 
      skippedCount: skipped.length,
      inserted,
      skipped 
    });
    await connection.commit();

    // Trigger update_data.js in background to update installations and actual stats
    if (inserted.length > 0 && !isSafeLocalMode() && isCronEnabled()) {
      console.log(`[BULK IMPORT] Successfully committed ${inserted.length} projects. Running update_data.js in the background...`);
      exec('node update_data.js', { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[BULK IMPORT ERROR] failed to run update_data.js: ${error}`);
          return;
        }
        console.log(`[BULK IMPORT SUCCESS] update_data.js output:\n${stdout}`);
      });
    }

    // Log import history
    if (req.user) {
      try {
        await connection.query(
          `INSERT INTO import_history 
           (user_id, user_role, user_zone, file_name, total_records, imported_records, skipped_records) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id, 
            req.user.role, 
            req.user.area || null, 
            file_name || 'unknown.csv', 
            projects.length, 
            inserted.length, 
            skipped.length
          ]
        );
      } catch (logErr) {
        console.error('[BULK IMPORT] Failed to log import history:', logErr);
      }
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
    if (isContractNoDuplicateError(error)) {
      const message = 'ไม่สามารถนำเข้าไฟล์ได้ เนื่องจากมีโครงการอื่นบันทึกเลขที่สัญญาเดียวกันในระหว่างการนำเข้า กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง';
      return res.status(409).json({ success: false, code: 'CONTRACT_NO_ALREADY_USED', message, error: message });
    }
    if (isProjectCodeDuplicateError(error)) {
      const message = 'ไม่สามารถนำเข้าไฟล์ได้ เนื่องจากมีรหัสโครงการซ้ำในระบบ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง';
      return res.status(409).json({ success: false, code: 'PROJECT_CODE_ALREADY_USED', message, error: message });
    }
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูลแบบกลุ่ม', details: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// ดึงประวัติการนำเข้าไฟล์ CSV
app.get('/api/projects/import-history', requireAdminAuth, async (req, res) => {
  try {
    const pool = db.getPool();
    let sql = 'SELECT * FROM import_history';
    const params = [];

    // ถ้าเป็น RegAdmin ให้ดูได้เฉพาะของเขตตัวเอง
    if (req.user.role?.toLowerCase() === 'regadmin' && req.user.area) {
      sql += ' WHERE user_zone = ?';
      params.push(req.user.area);
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, history: rows });
  } catch (error) {
    console.error('Failed to fetch import history:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงประวัติการนำเข้า', details: error.message });
  }
});

// ดึงข้อมูลวิเคราะห์ประเมินการใช้น้ำ (Water Consumption Analysis)
app.get('/api/water-usage/summary', async (req, res) => {
  try {
    const { branch, year, type, zone } = req.query;

    // Build filter parts
    // เพิ่มการกรองข้อมูลการใช้น้ำ (debt_trn) ให้ตรงตามเงื่อนไขกรอบเวลาการประเมินโครงการ (ประเภท 4 = 1 ปี, ประเภท 1-3 = 5 ปี)
    // โดยคำนวณช่วงของปีงบประมาณตรงกับโครงสร้างข้อมูลเพื่อประสิทธิภาพสูงสุด (หลีกเลี่ยงการทำ CAST/SUBSTRING บนตารางใหญ่)
    let whereClauses = [];
    let params = [];
    addProjectAreaScope(req, whereClauses, params);

    if (branch && branch !== 'all') {
      whereClauses.push('p.pwa_code = ?');
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
    if (isAdmin(req.user) && zone && zone !== 'all') {
      whereClauses.push('p.pwa_code IN (SELECT pwa_code FROM pwa_branches WHERE zone = ?)');
      params.push(parseInt(zone));
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // 1. Query Total Users (จากตาราง project_usage_summary)
    const metricsPromise = db.query(`
      SELECT COALESCE(SUM(pus.total_users), 0) as total_users
      FROM project_usage_summary pus
      JOIN projects p ON pus.project_code = p.project_code
      ${whereSql}
    `, params);

    // 2. Query Raw Grouped Data (จากตาราง project_monthly_usage)
    const groupedPromise = db.query(`
      SELECT 
        p.project_code,
        p.contract_no,
        p.project_name,
        p.project_type,
        p.branch_name,
        COALESCE(p.budget, 0.00) as budget,
        pmu.debt_ym,
        pmu.total_bills,
        pmu.total_usage,
        pmu.total_amount
      FROM project_monthly_usage pmu
      JOIN projects p ON pmu.project_code = p.project_code
      ${whereSql}
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
    addProjectAreaScope(req, whereClauses, params);

    if (branch && branch !== 'all') {
      whereClauses.push('p.pwa_code = ?');
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
    if (!await ensureProjectAreaAccess(req, res, project_code)) return;

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

    if (isSafeLocalMode() || !isSchemaInitEnabled()) {
      console.log('Startup schema modifications are disabled.');
    } else {
      // Ensure remarks column exists in projects and plan_master
      const projectsCols = await db.query('SHOW COLUMNS FROM projects LIKE "remarks"');
      if (projectsCols.length === 0) {
        console.log('Adding column remarks to projects table...');
        await db.query('ALTER TABLE projects ADD COLUMN remarks VARCHAR(500) NULL;');
      }
      const planMasterCols = await db.query('SHOW COLUMNS FROM plan_master LIKE "remarks"');
      if (planMasterCols.length === 0) {
        console.log('Adding column remarks to plan_master table...');
        await db.query('ALTER TABLE plan_master ADD COLUMN remarks VARCHAR(500) NULL;');
      }
    }
    

// ==========================================
// ==========================================
// NEW ENDPOINT: Early Customers Details
// ==========================================

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
  if (date1.year !== date2.year) return date1.year > date2.year;
  if (date1.month !== date2.month) return date1.month > date2.month;
  return date1.day > date2.day;
}

app.get('/api/projects/:code/early-customers', requireEarlyReportAuth, async (req, res) => {
  try {
    const projectCode = req.params.code;
    if (!await ensureProjectAreaAccess(req, res, projectCode)) return;
    
    // Get project completion date
    const projects = await db.query(
      'SELECT completion_year, completed_date, start_year FROM projects WHERE project_code = ?',
      [projectCode]
    );
    
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const pInfo = projects[0];
    let compDate = parseCompletedDate(pInfo.completed_date);
    if (!compDate && pInfo.start_year) {
      // Fallback to start of fiscal year: Oct 1st of (proj_year - 1)
      compDate = { year: pInfo.start_year - 1, month: 10, day: 1 };
    }
    if (!compDate) {
       // Just fallback to Jan 1st of completion_year if everything else fails
       compDate = { year: pInfo.completion_year, month: 1, day: 1 };
    }
    
    // Get all customers linked to this project using both project_no_proj and project_no_pipe
    const customers = await db.query(
      `WITH matched_proj_cus AS (
         SELECT pc.Id
         FROM projects p
         JOIN proj_cus pc
           ON pc.project_no_proj_normalized = p.contract_no_normalized
         WHERE p.project_code = ?

         UNION

         SELECT pc.Id
         FROM projects p
         JOIN proj_cus pc
           ON pc.project_no_pipe_normalized = p.contract_no_normalized
         WHERE p.project_code = ?
       )
       SELECT
          COALESCE(cust.cus_code, pc.custcode) as custcode, 
          COALESCE(cust.fullName, 'ไม่พบรายชื่อในฐานข้อมูล') as custname, 
          cust.BGN_DATE, 
          pc.bgncustdt,
          pc.contrac_date, 
          cust.status as custstat, 
          pc.pwa_code as ba, 
          b.branch_name
       FROM matched_proj_cus matched
       JOIN proj_cus pc ON pc.Id = matched.Id
       LEFT JOIN customer cust ON pc.custcode = cust.cus_code
       LEFT JOIN pwa_branches b ON pc.pwa_code = b.pwa_code
       `,
      [projectCode, projectCode]
    );
    
    const earlyCustomers = [];
    
    for (const c of customers) {
      let bgnDate = parseBgnDate(c.BGN_DATE);
      if (!bgnDate) {
        bgnDate = parseBgncustdt(c.bgncustdt);
      }
      
      if (!bgnDate) continue;
      
      const isEarly = !isAfter(bgnDate, compDate);
      if (isEarly) {
        c.bgn_date = c.BGN_DATE || c.bgncustdt; // Frontend uses bgn_date
        earlyCustomers.push(c);
      }
    }
    
    res.json(earlyCustomers);
  } catch (error) {
    console.error('Error fetching early customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

    app.listen(PORT, () => {
      const dbHost = process.env.DB_HOST || '127.0.0.1';
      const dbPort = process.env.DB_PORT || '3306';
      const dbName = process.env.DB_DATABASE || 'pwa6_expansion';
      console.log('\n==================================================');
      console.log(` PWA Area 6 System API Server started successfully.`);
      console.log(` - Port: http://localhost:${PORT}`);
      console.log(` - MySQL: ${dbHost}:${dbPort} (${dbName})`);
      console.log(` - Safe Local Mode: ${isSafeLocalMode() ? 'ON (read-only)' : 'OFF'}`);
      console.log(` - Schema Init: ${isSchemaInitEnabled() ? 'ON' : 'OFF'}`);
      console.log(` - Cron: ${isCronEnabled() ? 'ON' : 'OFF'}`);
      console.log('==================================================\n');
    });
  } catch (error) {
    console.error('✗ Failed to start API Server due to database issue:', error.message);
    process.exit(1);
  }
}

// --- CRON JOBS ---
// คำนวณตารางสถิติใหม่หลังระบบภายนอกโหลดข้อมูลดิบเสร็จ ทุกวันเวลา 02:00
if (isSafeLocalMode() || !isCronEnabled()) {
  console.log('Cron jobs are disabled.');
} else {
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
}

startServer();
