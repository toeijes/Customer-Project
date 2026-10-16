process.env.JWT_SECRET = 'test-project-types-secret';
process.env.ENABLE_CRON = 'false';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../db');
const logger = require('../utils/logger');

vi.spyOn(db, 'isSafeLocalMode').mockReturnValue(false);
vi.spyOn(db, 'query').mockResolvedValue([{
  id: 'admin-id', local_username: 'admin', actual_role: 'admin',
  is_active: 1, role_is_active: 1
}]);
vi.spyOn(logger, 'logSystemActionWithConnection').mockResolvedValue();
const connection = {
  beginTransaction: vi.fn().mockResolvedValue(),
  commit: vi.fn().mockResolvedValue(),
  rollback: vi.fn().mockResolvedValue(),
  release: vi.fn(),
  query: vi.fn()
};
vi.spyOn(db, 'getPool').mockReturnValue({ getConnection: async () => connection });
const { app } = require('../server');

beforeEach(() => {
  connection.query.mockReset().mockImplementation(async sql => {
    if (sql.includes('SELECT pwa_code, branch_name, zone')) {
      return [[{ pwa_code: '1059', branch_name: 'Test branch', zone: 6 }]];
    }
    return [[]];
  });
});

describe('project type assessment', () => {
  it('creates type 5 with the same five-year targets as type 1 and keeps type 4 at one year', async () => {
    const token = jwt.sign({ id: 'admin-id' }, process.env.JWT_SECRET);
    const schedules = {};
    for (const type of [1, 5, 4]) {
      connection.query.mockClear();
      const response = await request(app).post('/api/projects')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', `pwa_auth_session=${token}`)
        .send({
          project_code: `TEST-${type}`, contract_no: `TEST/${type}`, branch_name: 'Test branch',
          pwa_code: '1059', project_name: 'Test project', project_type: String(type),
          start_year: 2569, completed_date: '01/10/2569', budget: 100000, target_users: 100
        });
      expect(response.status).toBe(200);
      const projectInsert = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO projects'));
      expect(projectInsert[1][5]).toBe(type);
      const masterInsert = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO plan_master'));
      expect(masterInsert[1][12]).toBe(String(type));
      const yearlyInsert = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO project_yearly_performance'));
      schedules[type] = yearlyInsert[1][0].map(row => row.slice(1));
    }
    expect(schedules[5]).toEqual(schedules[1]);
    expect(schedules[5].map(row => row[0])).toEqual([2570, 2571, 2572, 2573, 2574, 2575]);
    expect(schedules[5].map(row => row[3])).toEqual([40, 0, 15, 15, 15, 15]);
    expect(schedules[4]).toEqual([[2570, 'completion_year', 100, 100, 0]]);
  });
});

describe('editing project type', () => {
  const token = jwt.sign({ id: 'admin-id' }, process.env.JWT_SECRET);
  const edit = body => request(app).put('/api/projects/EDIT-TEST/contract')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', `pwa_auth_session=${token}`)
    .send({ contract_no: 'TEST/2560', completed_date: '01/09/2560', ...body });

  function mockProject(previousType = 4, failRevenue = false) {
    connection.query.mockImplementation(async sql => {
      if (sql.includes('SELECT project_type, start_year')) return [[{ project_type: previousType, start_year: 2560, remarks: 'Keep this note' }]];
      if (sql.includes('SELECT target_users, project_name')) return [[{ target_users: 100, project_name: 'Test', branch_name: 'Branch' }]];
      if (sql.includes('c.BGN_DATE')) return [[
        { custcode: 'early', BGN_DATE: '2017-08-01' },
        { custcode: 'early', BGN_DATE: '2017-08-01' },
        { custcode: 'year0' },
        { custcode: 'year0', BGN_DATE: '2017-09-15' },
        { custcode: 'year0', BGN_DATE: '2017-09-15' },
        { custcode: 'year1', BGN_DATE: '2017-10-05' },
        { custcode: 'year5', BGN_DATE: '2022-09-01' },
        { custcode: 'year6', BGN_DATE: '2022-10-01' },
        { custcode: 'fallback', bgncustdt: '600920' },
        { custcode: 'future', BGN_DATE: '2099-01-01' },
      ]];
      if (failRevenue && sql.includes('INSERT INTO project_investment_monthly_revenue')) throw new Error('Test revenue failure');
      return [[]];
    });
  }

  it.each([[4, 5, 6, 4], [5, 4, 1, 2]])('changes type %i to %i and rebuilds the correct assessment window', async (previous, next, years, eligibleCount) => {
    mockProject(previous);
    const response = await edit({ project_type: next });
    expect(response.status).toBe(200);
    expect(response.body.project_type).toBe(next);
    const calls = connection.query.mock.calls;
    expect(calls.find(([sql]) => sql.startsWith('UPDATE projects SET contract_no'))[1].slice(3, 5)).toEqual(['Keep this note', next]);
    expect(calls.find(([sql]) => sql.startsWith('UPDATE plan_master SET'))[1][4]).toBe(String(next));
    const eligible = calls.find(([sql]) => sql.includes('INSERT INTO eligible_customers'))[1][0];
    expect(eligible).toHaveLength(eligibleCount);
    expect(eligible.map(row => row[1])).not.toContain('year6');
    const yearly = calls.find(([sql]) => sql.includes('INSERT INTO project_yearly_performance'))[1][0];
    expect(yearly).toHaveLength(years);
    expect(yearly.reduce((sum, row) => sum + row[5], 0)).toBe(eligibleCount);
    const monthly = calls.find(([sql]) => sql.includes('INSERT INTO monthly_actual_users'))[1][0];
    expect(monthly.every(row => row[3] === next)).toBe(true);
    expect(monthly.reduce((sum, row) => sum + row[7], 0)).toBe(eligibleCount);
    expect(monthly.reduce((sum, row) => sum + row[8], 0)).toBe(1);
    expect(calls.some(([sql]) => sql.includes('INSERT INTO project_monthly_usage'))).toBe(true);
    expect(calls.some(([sql]) => sql.includes('INSERT INTO project_investment_monthly_revenue'))).toBe(true);
    expect(connection.commit).toHaveBeenCalled();
  });

  it.each([0, 6, 4.5, '', null, true, [], {}])('rejects invalid type %j before writing', async project_type => {
    const response = await edit({ project_type });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_PROJECT_TYPE');
    expect(connection.query).not.toHaveBeenCalled();
  });

  it('preserves the existing type for older clients that omit it', async () => {
    mockProject(5);
    const response = await edit({});
    expect(response.status).toBe(200);
    expect(response.body.project_type).toBe(5);
  });

  it('rolls back the edit when revenue refresh fails', async () => {
    mockProject(4, true);
    connection.commit.mockClear();
    connection.rollback.mockClear();
    const response = await edit({ project_type: 5 });
    expect(response.status).toBe(500);
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('rejects conflicting original start dates before updating project or summary data', async () => {
    mockProject(4);
    const previousImplementation = connection.query.getMockImplementation();
    connection.query.mockImplementation(async (sql, params) => {
      if (sql.includes('HAVING COUNT(DISTINCT BGN_DATE) > 1')) return [[{ cus_code: 'conflict' }]];
      return previousImplementation(sql, params);
    });
    const response = await edit({ project_type: 5 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CUSTOMER_DATE_CONFLICT');
    expect(connection.query.mock.calls.some(([sql]) => /UPDATE projects|DELETE FROM/.test(sql))).toBe(false);
  });
});
