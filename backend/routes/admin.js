const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { logSystemAction } = require('../utils/logger');

// ----------------------------------------------------
// USER MANAGEMENT
// ----------------------------------------------------

// 1. List all users + roles
router.get('/users', async (req, res) => {
  try {
    const users = await db.query(`
      SELECT 
        u.id, u.pwa_username, u.local_username, u.firstname, u.lastname, 
        u.email, u.position, u.ba, u.is_active, u.last_login, u.role as legacy_role,
        ur.role_id, r.name as role_name, r.level as role_level
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      ORDER BY r.level DESC, u.firstname ASC
    `);

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
          ba: row.ba,
          is_active: row.is_active,
          last_login: row.last_login,
          role: row.legacy_role, // legacy role string
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

// 2. Update Legacy Role directly (PUT /users/[id])
router.put('/users/:id', async (req, res) => {
  try {
    const { role } = req.body;
    
    if (req.user.id === req.params.id && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot remove own admin role' });
    }

    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ success: true, data: { id: req.params.id, role } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Toggle Active (PUT /users/[id]/active)
router.put('/users/:id/active', async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (req.user.id === req.params.id && !isActive) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate own account' });
    }

    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, req.params.id]);
    await logSystemAction(req, req.user, 'UPDATE_STATUS', 'USERS', req.params.id, { isActive });
    res.json({ success: true, data: { id: req.params.id, is_active: isActive } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get Role Assignments
router.get('/users/:id/roles', async (req, res) => {
  try {
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
router.put('/users/:id/roles', async (req, res) => {
  try {
    const { roleId } = req.body;
    
    // Check if role exists and is active
    const [role] = await db.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!role) return res.status(404).json({ success: false, error: 'Role not found' });
    if (!role.is_active) return res.status(400).json({ success: false, error: 'Role is inactive' });

    // Delete existing and insert new
    await db.query('DELETE FROM user_roles WHERE user_id = ?', [req.params.id]);
    await db.query('INSERT INTO user_roles (id, user_id, role_id, assigned_by) VALUES (?, ?, ?, ?)', [
      uuidv4(), req.params.id, roleId, req.user.id
    ]);

    // Update legacy role
    const legacyRole = role.level >= 100 ? 'admin' : 'user';
    await db.query('UPDATE users SET role = ? WHERE id = ?', [legacyRole, req.params.id]);

    await logSystemAction(req, req.user, 'UPDATE_ROLE', 'USERS', req.params.id, { role_id: roleId, role_name: role.name });

    res.json({ success: true, data: { user_id: req.params.id, role_id: roleId, legacy_role: legacyRole } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
router.post('/roles', async (req, res) => {
  try {
    const { name, description, level, permissions } = req.body;
    const id = uuidv4();
    
    await db.query(`
      INSERT INTO roles (id, name, description, level, permissions, is_active)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `, [id, name, description, level || 0, JSON.stringify(permissions || [])]);
    
    await logSystemAction(req, req.user, 'CREATE_ROLE', 'ROLES', id, { name, level });

    res.status(201).json({ success: true, data: { id, name, description, level } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Role name must be unique' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Update Role
router.put('/roles/:id', async (req, res) => {
  try {
    const { name, description, level, permissions, isActive } = req.body;
    const [existing] = await db.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Role not found' });

    await db.query(`
      UPDATE roles 
      SET name = COALESCE(?, name), 
          description = COALESCE(?, description), 
          level = COALESCE(?, level), 
          permissions = COALESCE(?, permissions),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [
      name, description, level, 
      permissions ? JSON.stringify(permissions) : null, 
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      req.params.id
    ]);

    await logSystemAction(req, req.user, 'UPDATE_ROLE_INFO', 'ROLES', req.params.id, { name, level });

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Delete Role
router.delete('/roles/:id', async (req, res) => {
  try {
    const [role] = await db.query('SELECT name FROM roles WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM roles WHERE id = ?', [req.params.id]); // Cascades to user_roles automatically
    await logSystemAction(req, req.user, 'DELETE_ROLE', 'ROLES', req.params.id, { role_name: role ? role.name : null });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Toggle Active
router.put('/roles/:id/toggle-active', async (req, res) => {
  try {
    await db.query('UPDATE roles SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    await logSystemAction(req, req.user, 'TOGGLE_ROLE_STATUS', 'ROLES', req.params.id, null);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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

    const logs = await db.query(`
      SELECT sl.*, r.name as role_name, r.level as role_level
      FROM system_logs sl
      LEFT JOIN user_roles ur ON sl.user_id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      ORDER BY sl.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const totalCountResult = await db.query('SELECT COUNT(*) as total FROM system_logs');
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
