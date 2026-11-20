process.env.JWT_SECRET = 'custom-roles-test-secret';
process.env.ENABLE_CRON = 'false';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const logger = require('../utils/logger');
const query = vi.spyOn(db, 'query');
const getPool = vi.spyOn(db, 'getPool');
const safeMode = vi.spyOn(db, 'isSafeLocalMode');
const log = vi.spyOn(logger, 'logSystemActionWithConnection');
const { app } = require('../server');
const adminRouter = require('../routes/admin');

// Exercise all route middleware, with a trusted test identity supplied at the mount.
const roleApp = role => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use((req, res, next) => { req.user = { id: 'admin-id', role }; next(); });
  testApp.use(adminRouter);
  return testApp;
};
let connection;
beforeEach(() => {
  query.mockReset(); getPool.mockReset(); safeMode.mockReturnValue(false); log.mockReset().mockResolvedValue();
  connection = { beginTransaction: vi.fn(), query: vi.fn().mockResolvedValue([[]]), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
  getPool.mockReturnValue({ getConnection: async () => connection });
});

describe('admin-only role creation', () => {
  it.each(['RegAdmin', 'planning', 'user', 'other', 'manager'])('rejects %s before accessing the database', async role => {
    const result = await request(roleApp(role)).post('/roles').send({ name: 'manager' });
    expect(result.status).toBe(403);
    expect(getPool).not.toHaveBeenCalled();
  });
  it('creates and logs a normalized role in one transaction', async () => {
    const result = await request(roleApp('admin')).post('/roles').send({ name: ' Manager ', description: ' อ่านข้อมูล ', level: 0 });
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ name: 'manager', description: 'อ่านข้อมูล', level: 0, is_active: 1 });
    expect(connection.query.mock.calls[1][1]).toEqual([expect.any(String), 'manager', 'อ่านข้อมูล', '{}']);
    expect(log).toHaveBeenCalledWith(connection, expect.anything(), expect.anything(), 'CREATE_ROLE', 'ROLES', expect.any(String), { role_name: 'manager', role_level: 0 });
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
  it.each([{ name: '' }, { name: 'x'.repeat(101) }, { name: 'bad role' }, { name: 'manager', level: 100 }, { name: 'manager', permissions: { admin: true } }, { name: 'manager', description: {} }])('rejects invalid data %j', async body => {
    expect((await request(roleApp('admin')).post('/roles').send(body)).status).toBe(400);
    expect(getPool).not.toHaveBeenCalled();
  });
  it('rejects duplicate and system names without inserting', async () => {
    connection.query.mockResolvedValueOnce([[{ id: 'existing' }]]);
    expect((await request(roleApp('admin')).post('/roles').send({ name: 'manager' })).status).toBe(409);
    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalled();
  });
  it('reserves system names even if a system role is missing', async () => {
    expect((await request(roleApp('admin')).post('/roles').send({ name: 'ADMIN' })).status).toBe(409);
    expect(getPool).not.toHaveBeenCalled();
  });
  it('handles concurrent duplicate inserts', async () => {
    connection.query.mockResolvedValueOnce([[]]).mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });
    expect((await request(roleApp('admin')).post('/roles').send({ name: 'manager' })).status).toBe(409);
    expect(connection.rollback).toHaveBeenCalled();
  });
  it('rolls back if audit logging fails', async () => {
    log.mockRejectedValue(new Error('log failed'));
    expect((await request(roleApp('admin')).post('/roles').send({ name: 'manager' })).status).toBe(500);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });
  it('honours read-only local mode', async () => {
    safeMode.mockReturnValue(true);
    expect((await request(roleApp('admin')).post('/roles').send({ name: 'manager' })).status).toBe(403);
    expect(getPool).not.toHaveBeenCalled();
  });
});

describe('custom role authentication', () => {
  const account = { id: 'reader-id', actual_role: 'manager', role_is_active: 1, is_active: 1, legacy_role: 'user', role: 'user', area: '6', local_username: 'reader' };
  const cookie = () => `pwa_auth_session=${jwt.sign({ id: account.id, role: 'admin' }, process.env.JWT_SECRET)}`;
  it('uses the current assigned role instead of stale token privileges', async () => {
    query.mockResolvedValue([account]);
    const result = await request(app).get('/api/auth/me').set('Cookie', cookie());
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).toContain('manager');
    expect((await request(app).post('/api/admin/roles').set('Cookie', cookie()).send({ name: 'another' })).status).toBe(403);
    expect((await request(app).patch('/api/projects/A/evaluation').set('Cookie', cookie()).send({ evaluation_enabled: false })).status).toBe(403);
  });
  it('allows local login for an assigned active custom role', async () => {
    const password = await bcrypt.hash('TestPassword123', 4);
    query.mockImplementation(async sql => sql.includes('WHERE u.local_username') ? [{ ...account, password }] : []);
    const result = await request(app).post('/api/auth/login').send({ username: 'reader', password: 'TestPassword123' });
    expect(result.status).toBe(200);
    expect(result.body.data.user.role).toBe('manager');
  });
  it('rejects disabled assigned roles', async () => {
    query.mockResolvedValue([{ ...account, role_is_active: 0 }]);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie())).status).toBe(401);
  });
  it('does not accept a custom name from the legacy role field alone', async () => {
    query.mockResolvedValue([{ ...account, actual_role: null, legacy_role: 'manager' }]);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie())).status).toBe(403);
  });
});
