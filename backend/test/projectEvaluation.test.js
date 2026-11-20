process.env.JWT_SECRET = 'project-evaluation-test-secret';
process.env.ENABLE_CRON = 'false';
const db = require('../db');
const logger = require('../utils/logger');
vi.spyOn(logger, 'logSystemActionWithConnection').mockResolvedValue();
const { app } = require('../server');
const { isEvaluationEnabled, ensureEvaluationColumn } = require('../utils/projectEvaluation');
const query = vi.spyOn(db, 'query');
const getPool = vi.spyOn(db, 'getPool');
const handler = (path, method = 'get') => app._router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
beforeEach(() => { query.mockReset(); getPool.mockReset(); });

describe('user evaluation settings', () => {
  it.each([1, 2, 3, 4])('includes type %s by default', project_type => {
    expect(isEvaluationEnabled({ project_type, evaluation_enabled: null })).toBe(true);
  });
  it('excludes type 5 by default and honours explicit choices in either direction', () => {
    expect(isEvaluationEnabled({ project_type: 5 })).toBe(false);
    expect(isEvaluationEnabled({ project_type: 5, evaluation_enabled: 1 })).toBe(false);
    expect(isEvaluationEnabled({ project_type: 1, evaluation_enabled: 0 })).toBe(false);
  });
  it('does not change an already migrated column or reset choices', async () => {
    const connection = { query: vi.fn().mockResolvedValue([[{ Field: 'evaluation_enabled' }]]) };
    await ensureEvaluationColumn(connection);
    expect(connection.query).toHaveBeenCalledTimes(1);
  });
  it('rejects enabling type 5 even through a direct API request', async () => {
    query.mockResolvedValue([{ pwa_code: '1060', project_type: 5 }]);
    const res = response();
    await handler('/api/projects/:project_code/evaluation', 'patch')({ body: { evaluation_enabled: true }, params: { project_code: 'A' }, user: { role: 'admin' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(getPool).not.toHaveBeenCalled();
  });
  it.each(['false', 1, null, undefined])('rejects invalid setting %s without writing', async evaluation_enabled => {
    const res = response();
    await handler('/api/projects/:project_code/evaluation', 'patch')({ body: { evaluation_enabled } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(getPool).not.toHaveBeenCalled();
  });
  it('checks project area before allowing a setting update', async () => {
    query.mockResolvedValueOnce([{ pwa_code: '1060', project_type: 1 }]).mockResolvedValueOnce([]);
    const res = response();
    await handler('/api/projects/:project_code/evaluation', 'patch')({ body: { evaluation_enabled: false }, params: { project_code: 'A' }, user: { role: 'planning', area: '7' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(getPool).not.toHaveBeenCalled();
  });
  it.each([true, false])('saves explicit %s without rebuilding summaries', async enabled => {
    query.mockResolvedValue([{ pwa_code: '1060', project_type: 1 }]);
    const connection = { beginTransaction: vi.fn(), query: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    getPool.mockReturnValue({ getConnection: async () => connection });
    const res = response();
    await handler('/api/projects/:project_code/evaluation', 'patch')({ body: { evaluation_enabled: enabled }, params: { project_code: 'A' }, user: { role: 'admin' } }, res);
    expect(connection.query).toHaveBeenCalledExactlyOnceWith('UPDATE projects SET evaluation_enabled = ? WHERE project_code = ?', [enabled ? 1 : 0, 'A']);
    expect(connection.commit).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, evaluation_enabled: enabled });
  });
  it('excludes only user results of an excluded contributor, retaining revenue and usage', async () => {
    query.mockResolvedValueOnce([{ pwa_code: '1060' }]).mockResolvedValueOnce([
      { group_id: 1, member_role: 'primary', project_type: 1, evaluation_enabled: 1, target_users: 100, budget: 1000, total_actual_users: 10, total_usage: 20, total_amount: 30 },
      { member_role: 'contributor', project_type: 5, evaluation_enabled: 0, total_actual_users: 50, total_usage: 60, total_amount: 70 }
    ]);
    const res = response();
    await handler('/api/project-evaluation-links')({ query: { project_code: 'A' }, user: { role: 'admin' } }, res);
    expect(res.json.mock.calls[0][0].group.summary).toMatchObject({ actual_users: 10, total_usage: 80, total_amount: 100, achievement_rate: 10, recovery_rate: 10 });
  });
  it('filters user-summary reports without filtering the project register', async () => {
    query.mockResolvedValue([]);
    await handler('/api/reports/project-summary')({ user: { role: 'admin' } }, response());
    expect(query.mock.calls.every(([sql]) => sql.includes('(p.project_type IN (1, 2, 3, 4) AND COALESCE(p.evaluation_enabled, 1) = 1)'))).toBe(true);
    query.mockClear();
    await handler('/api/projects')({ user: { role: 'admin' } }, response());
    expect(query.mock.calls.every(([sql]) => !sql.slice(sql.indexOf('WHERE')).includes('(p.project_type IN (1, 2, 3, 4) AND COALESCE(p.evaluation_enabled, 1) = 1)'))).toBe(true);
  });
});
