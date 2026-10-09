process.env.JWT_SECRET = 'test-ldap-session-secret';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.ENABLE_CRON = 'false';
process.env.COOKIE_SECURE = 'false';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const ldap = require('../utils/ldapAuth');
const logger = require('../utils/logger');
const query = vi.spyOn(db, 'query');
vi.spyOn(db, 'isSafeLocalMode').mockReturnValue(false);
const authenticate = vi.spyOn(ldap, 'authenticateLdap');
vi.spyOn(logger, 'logSystemAction').mockResolvedValue();
vi.spyOn(logger, 'logSystemActionWithConnection').mockResolvedValue();
const { app } = require('../server');

const existing = {
  id: 'existing-id', pwa_username: '15818', is_active: 1, actual_role: 'planning', role_is_active: 1,
  firstname: 'Old', lastname: 'Name', area: '7', part: 'old-part', dep_name: 'old-department'
};
const profile = {
  username: '15818', firstname: 'New', lastname: 'Name', area: '6', level: '7',
  ba: '1059', costcenter: '101932', job_name: 'งานประมวลข้อมูล', dep_name: ''
};

beforeEach(() => {
  query.mockReset();
  authenticate.mockReset().mockResolvedValue(profile);
  query.mockImplementation(async sql => {
    if (sql.includes('WHERE u.local_username')) return [];
    if (sql.includes('WHERE u.pwa_username')) return [existing];
    return [];
  });
});

describe('LDAP login endpoint', () => {
  it('preserves an existing role and unsupported fields while refreshing LDAP profile and region', async () => {
    const response = await request(app).post('/api/auth/login').send({ username: 'PWA\\15818', password: 'secret' });
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ id: existing.id, username: '15818', role: 'planning', area: '6', level_name: '7' });
    const update = query.mock.calls.find(([sql]) => sql.includes('UPDATE users') && sql.includes('firstname ='));
    expect(update[1][5]).toBe('101932');
    expect(update[1][6]).toBe('1059');
    expect(update[1][7]).toBe('old-part');
    expect(update[1][8]).toBe('6');
    expect(update[1][11]).toBe('old-department');
    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    const token = cookie.split(';')[0].split('=')[1];
    expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({ role: 'planning', area: '6' });
  });

  it('clears a previous region when the AD OU has no verified mapping', async () => {
    authenticate.mockResolvedValue({ ...profile, area: null });
    const response = await request(app).post('/api/auth/login').send({ username: '15818', password: 'secret' });
    expect(response.body.data.user.area).toBeNull();
    const update = query.mock.calls.find(([sql]) => sql.includes('UPDATE users') && sql.includes('firstname ='));
    expect(update[1][8]).toBeNull();
  });

  it('does not let AD reactivate a deactivated account or inactive role', async () => {
    for (const [account, status] of [[{ ...existing, is_active: 0 }, 401], [{ ...existing, role_is_active: 0 }, 403]]) {
      query.mockImplementation(async sql => sql.includes('WHERE u.pwa_username') ? [account] : []);
      const response = await request(app).post('/api/auth/login').send({ username: '15818', password: 'secret' });
      expect(response.status).toBe(status);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('returns 401 for invalid credentials and 503 for AD service errors without a session', async () => {
    for (const [code, status] of [['invalid_credentials', 401], ['ldap_unavailable', 503], ['ldap_configuration_error', 503]]) {
      authenticate.mockRejectedValue(new ldap.LdapAuthError(code));
      const response = await request(app).post('/api/auth/login').send({ username: '15818', password: 'secret' });
      expect(response.status).toBe(status);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('keeps local account login working without contacting LDAP', async () => {
    const password = bcrypt.hashSync('local-secret', 4);
    query.mockImplementation(async sql => sql.includes('WHERE u.local_username')
      ? [{ ...existing, local_username: 'local-admin', password, actual_role: 'admin' }] : []);
    const response = await request(app).post('/api/auth/login').send({ username: 'local-admin', password: 'local-secret' });
    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe('admin');
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('provisions a new LDAP user with the default role in a transaction', async () => {
    query.mockResolvedValue([]);
    const connection = {
      beginTransaction: vi.fn().mockResolvedValue(), commit: vi.fn().mockResolvedValue(),
      rollback: vi.fn().mockResolvedValue(), release: vi.fn(),
      query: vi.fn(async sql => sql.includes('SELECT id FROM roles') ? [[{ id: 'user-role-id' }]] : [[]])
    };
    const getPool = vi.spyOn(db, 'getPool').mockReturnValue({ getConnection: async () => connection });
    const response = await request(app).post('/api/auth/login').send({ username: '15818', password: 'secret' });
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ username: '15818', area: '6', role: 'user' });
    const insert = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO users'));
    expect(insert[1][6]).toBe('7');
    expect(insert[1][7]).toBe('101932');
    expect(insert[1][8]).toBe('1059');
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
    getPool.mockRestore();
  });
});
