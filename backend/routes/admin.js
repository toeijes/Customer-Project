const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { logSystemActionWithConnection } = require('../utils/logger');

const isSafeLocalMode = () => db.isSafeLocalMode();
const blockSafeLocalWrite = (req, res, next) => {
  if (isSafeLocalMode()) {
    return res.status(403).json({
      success: false,
      error: 'SAFE_LOCAL_MODE is enabled: this local environment is read-only'
    });
  }
  next();
};

const requireAdminOnly = (req, res, next) => {
  if (req.user?.role?.toLowerCase() === 'admin') return next();
  return res.status(403).json({ success: false, error: 'Access denied. Admin role required.' });
};

// ----------------------------------------------------
// USER MANAGEMENT
// ----------------------------------------------------

// 1. List all users + roles
router.get('/users', async (req, res) => {
  try {
    let query = `
      SELECT 
        u.id, u.pwa_username, u.local_username, u.firstname, u.lastname, 
        u.email, u.position, u.level_name, u.job_name, u.div_name, u.ba, u.is_active, u.last_login, u.role as legacy_role, u.area,
        ur.role_id, r.name as role_name, r.level as role_level
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
    `;
    let queryParams = [];

    if ((req.user.role === 'RegAdmin' || req.user.role?.toLowerCase() === 'regadmin') && req.user.area) {
      query += ` WHERE u.area = ?`;
      queryParams.push(req.user.area);
    }

    query += ` ORDER BY r.level DESC, u.firstname ASC`;

    const users = await db.query(query, queryParams);


    // Group roles by user (a user might have multiple roles, though diagram says 1 in practice)
    const userMap = new Map();
    users.forEach(row => {
      if (!userMap.has(row.id)) {
        userMap.set(row.id, {
          id: row.id,
          pwa_username: row.pwa_username,
          local_username: row.local_username,
          firstname: row.firstname,
          lastname: row.lastname,
          email: row.email,
          position: row.position,
          level_name: row.level_name,
          job_name: row.job_name,
          div_name: row.div_name,
          ba: row.ba,
          is_active: row.is_active,
          last_login: row.last_login,
          role: row.role_name || row.legacy_role,
          area: row.area,
          roles: [] // mapped from user_roles
        });
      }
      if (row.role_id) {
        userMap.get(row.id).roles.push({
          id: row.role_id,
          name: row.role_name,
          level: row.role_level
        });
      }
    });

    res.json({ success: true, data: Array.from(userMap.values()) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a local account. PWA accounts are provisioned only through PWA authentication.
router.post('/users/local', requireAdminOnly, blockSafeLocalWrite, async (req, res) => {
  const {
    username,
    password,
    firstname,
    lastname,
    email,
    position,
    area,
    ba
  } = req.body;
  const normalizedUsername = String(username || '').trim();

  if (!/^[A-Za-z0-9._-]{3,100}$/.test(normalizedUsername)) {
    return res.status(400).json({ success: false, error: 'Username must be 3-100 characters and use only letters, numbers, dot, underscore, or hyphen.' });
  }
  if (typeof password !== 'string' || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ success: false, error: 'Password must be at least 12 characters and include uppercase, lowercase, and a number.' });
  }
  if (!String(firstname || '').trim() || !String(lastname || '').trim()) {
    return res.status(400).json({ success: false, error: 'Firstname and lastname are required.' });
  }
  if (!/^\d+$/.test(String(area || '').trim())) {
    return res.status(400).json({ success: false, error: 'Area is required.' });
  }

  let connection;
  try {
    connection = await db.getPool().getConnection();
    await connection.beginTransaction();
    const [duplicates] = await connection.query(
      'SELECT id FROM users WHERE local_username = ? OR pwa_username = ? LIMIT 1',
      [normalizedUsername, normalizedUsername]
    );
    if (duplicates.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, error: 'Username already exists.' });
    }

    const [roleRows] = await connection.query(
      'SELECT id FROM roles WHERE name = ? AND is_active = 1 LIMIT 1',
      ['user']
    );
    const defaultRole = roleRows[0];
    if (!defaultRole) throw new Error('Default user role is missing or inactive');

    const [areaRows] = await connection.query(
      ba
        ? 'SELECT 1 FROM pwa_branches WHERE zone = ? AND ba = ? LIMIT 1'
        : 'SELECT 1 FROM pwa_branches WHERE zone = ? LIMIT 1',
      ba ? [String(area).trim(), String(ba).trim()] : [String(area).trim()]
    );
    if (areaRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Area or branch is not valid.' });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    await connection.query(`
      INSERT INTO users
        (id, role, local_username, password, firstname, lastname, email, position, area, ba, is_active)
      VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `, [
      userId,
      normalizedUsername,
      passwordHash,
      String(firstname).trim(),
      String(lastname).trim(),
      email ? String(email).trim() : null,
      position ? String(position).trim() : null,
      String(area).trim(),
      ba ? String(ba).trim() : null
    ]);
    await connection.query(
      'INSERT INTO user_roles (id, user_id, role_id, assigned_by) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, defaultRole.id, req.user.id]
    );

    const createdUser = {
      id: userId,
      username: normalizedUsername,
      fullName: `${String(firstname).trim()} ${String(lastname).trim()}`,
      role: 'user',
      area: String(area).trim()
    };
    await logSystemActionWithConnection(
      connection,
      req,
      req.user,
      'CREATE_LOCAL_USER',
      'USERS',
      userId,
      { created_username: normalizedUsername, created_role: 'user', created_area: createdUser.area }
    );
    await connection.commit();

    res.status(201).json({ success: true, data: createdUser });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Failed to create local user:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Username already exists.' });
    }
    res.status(500).json({ success: false, error: 'Failed to create local user.' });
  } finally {
    if (connection) connection.release();
  }
});

// 2. Update Legacy Role directly (PUT /users/[id])
router.put('/users/:id', blockSafeLocalWrite, async (req, res) => {
  res.status(405).json({ success: false, error: 'Use the role-assignment endpoint.' });
});

// 3. Toggle Active (PUT /users/[id]/active)
router.put('/users/:id/active', blockSafeLocalWrite, async (req, res) => {
  let connection;
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive must be a boolean.' });
    }
    
    if (req.user.id === req.params.id && !isActive) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate own account' });
    }

    if ((req.user.role === 'RegAdmin' || req.user.role?.toLowerCase() === 'regadmin')) {
      const [targetUser] = await db.query(`
        SELECT u.area, COALESCE(r.name, u.role) AS role
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = ? LIMIT 1
      `, [req.params.id]);
      if (!targetUser || String(targetUser.area) !== String(req.user.area)) {
        return res.status(403).json({ success: false, error: 'RegAdmin can only modify users in their own region.' });
      }
      if (targetUser.role?.toLowerCase() === 'admin') {
        return res.status(403).json({ success: false, error: 'RegAdmin cannot modify admin accounts.' });
      }
    }

    connection = await db.getPool().getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, req.params.id]);
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    await logSystemActionWithConnection(connection, req, req.user, 'UPDATE_USER_STATUS', 'USERS', req.params.id, { isActive });
    await connection.commit();
    res.json({ success: true, data: { id: req.params.id, is_active: isActive } });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 4. Get Role Assignments
router.get('/users/:id/roles', async (req, res) => {
  try {
    if (req.user?.role?.toLowerCase() === 'regadmin') {
      const [targetUser] = await db.query('SELECT area FROM users WHERE id = ? LIMIT 1', [req.params.id]);
      if (!targetUser || String(targetUser.area) !== String(req.user.area)) {
        return res.status(403).json({ success: false, error: 'RegAdmin can only view users in their own region.' });
      }
    }
    const roles = await db.query(`
      SELECT r.id, r.name, r.level, ur.assigned_at 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `, [req.params.id]);
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Assign Role (PUT /users/[id]/roles)
router.put('/users/:id/roles', blockSafeLocalWrite, async (req, res) => {
  let connection;
  try {
    const { roleId } = req.body;
    
    // Check if role exists and is active
    const [role] = await db.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!role) return res.status(404).json({ success: false, error: 'Role not found' });
    if (!role.is_active) return res.status(400).json({ success: false, error: 'Role is inactive' });
    if (req.user.id === req.params.id && role.name.toLowerCase() !== req.user.role?.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'Cannot change own role.' });
    }

    if ((req.user.role === 'RegAdmin' || req.user.role?.toLowerCase() === 'regadmin')) {
      const [targetUser] = await db.query(`
        SELECT u.area, COALESCE(r.name, u.role) AS role
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = ? LIMIT 1
      `, [req.params.id]);
      if (!targetUser || String(targetUser.area) !== String(req.user.area)) {
        return res.status(403).json({ success: false, error: 'RegAdmin can only modify users in their own region.' });
      }
      if (targetUser.role?.toLowerCase() === 'admin') {
        return res.status(403).json({ success: false, error: 'RegAdmin cannot modify admin accounts.' });
      }
      const allowedRoles = ['planning', 'user', 'other'];
      if (!allowedRoles.includes(role.name.toLowerCase())) {
        return res.status(403).json({ success: false, error: 'RegAdmin can only assign Planning, User, or Other roles.' });
      }
    }

    connection = await db.getPool().getConnection();
    await connection.beginTransaction();
    await connection.query('DELETE FROM user_roles WHERE user_id = ?', [req.params.id]);
    await connection.query('INSERT INTO user_roles (id, user_id, role_id, assigned_by) VALUES (?, ?, ?, ?)', [
      uuidv4(), req.params.id, roleId, req.user.id
    ]);

    // Keep the legacy enum compatible; authorization uses user_roles/roles.
    const legacyRole = role.name.toLowerCase() === 'admin' ? 'admin' : 'user';
    await connection.query('UPDATE users SET role = ? WHERE id = ?', [legacyRole, req.params.id]);
    await logSystemActionWithConnection(connection, req, req.user, 'UPDATE_USER_ROLE', 'USERS', req.params.id, { role_id: roleId, role_name: role.name });
    await connection.commit();

    res.json({ success: true, data: { user_id: req.params.id, role_id: roleId, role: role.name, legacy_role: legacyRole } });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ----------------------------------------------------
// ROLE MANAGEMENT
// ----------------------------------------------------

// 1. List Roles
router.get('/roles', async (req, res) => {
  try {
    const roles = await db.query('SELECT * FROM roles ORDER BY level DESC');
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Create Role
router.post('/roles', blockSafeLocalWrite, async (req, res) => {
  if (req.user?.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, error: 'RegAdmin cannot manage roles.' });
  }
  return res.status(405).json({ success: false, error: 'The five system roles are fixed and no additional roles can be created.' });
});

// 3. Update Role
router.put('/roles/:id', blockSafeLocalWrite, async (req, res) => {
  let connection;
  try {
    if ((req.user.role === 'RegAdmin' || req.user.role?.toLowerCase() === 'regadmin')) return res.status(403).json({ success: false, error: 'RegAdmin cannot manage roles.' });
    const { name, description, level, permissions, isActive } = req.body;
    const [existing] = await db.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Role not found' });
    if ((name && name !== existing.name) || (level !== undefined && Number(level) !== Number(existing.level))) {
      return res.status(400).json({ success: false, error: 'System role names and levels cannot be changed.' });
    }

    connection = await db.getPool().getConnection();
    await connection.beginTransaction();
    await connection.query(`
      UPDATE roles 
      SET description = COALESCE(?, description),
          permissions = COALESCE(?, permissions),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [
      description,
      permissions !== undefined ? JSON.stringify(permissions) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      req.params.id
    ]);

    await logSystemActionWithConnection(connection, req, req.user, 'UPDATE_ROLE_INFO', 'ROLES', req.params.id, {
      role_name: existing.name,
      role_level: existing.level
    });
    await connection.commit();

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 4. Delete Role
router.delete('/roles/:id', blockSafeLocalWrite, async (req, res) => {
  if (req.user?.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, error: 'RegAdmin cannot manage roles.' });
  }
  return res.status(405).json({ success: false, error: 'System roles cannot be deleted.' });
});

// 5. Toggle Active
router.put('/roles/:id/toggle-active', blockSafeLocalWrite, async (req, res) => {
  let connection;
  try {
    if ((req.user.role === 'RegAdmin' || req.user.role?.toLowerCase() === 'regadmin')) return res.status(403).json({ success: false, error: 'RegAdmin cannot manage roles.' });
    connection = await db.getPool().getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query('UPDATE roles SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Role not found' });
    }
    await logSystemActionWithConnection(connection, req, req.user, 'TOGGLE_ROLE_STATUS', 'ROLES', req.params.id, null);
    await connection.commit();
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ----------------------------------------------------
// SYSTEM LOGS
// ----------------------------------------------------

// 1. Get System Logs
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let query = `
      SELECT sl.*, r.name as role_name, r.level as role_level, u.area, u.ba
      FROM system_logs sl
      LEFT JOIN user_roles ur ON sl.user_id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN users u ON sl.user_id = u.id
    `;
    let queryParams = [];

    if ((req.user.role === 'RegAdmin' || req.user.role?.toLowerCase() === 'regadmin') && req.user.area) {
      query += ` WHERE u.area = ?`;
      queryParams.push(req.user.area);
    }
    
    query += ` ORDER BY sl.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const logs = await db.query(query, queryParams);

    let countQuery = 'SELECT COUNT(*) as total FROM system_logs sl LEFT JOIN users u ON sl.user_id = u.id';
    let countParams = [];
    if ((req.user.role === 'RegAdmin' || req.user.role?.toLowerCase() === 'regadmin') && req.user.area) {
      countQuery += ` WHERE u.area = ?`;
      countParams.push(req.user.area);
    }
    const totalCountResult = await db.query(countQuery, countParams);
    const total = totalCountResult[0].total;

    res.json({ 
      success: true, 
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
