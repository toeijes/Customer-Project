process.env.JWT_SECRET = 'test-project-link-branch-secret';
process.env.ENABLE_CRON = 'false';
const db = require('../db');
const { app } = require('../server');
const query = vi.spyOn(db, 'query');
const getPool = vi.spyOn(db, 'getPool');
const handler = path => app._router.stack.find(layer => layer.route?.path === path && layer.route.methods.post).route.stack.at(-1).handle;
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

beforeEach(() => { query.mockReset(); getPool.mockReset(); });

describe('project evaluation branch restriction', () => {
  it.each([['1060', '1061'], [null, '1060'], ['1060', null], ['', '']])('rejects existing project links for branches %s and %s even for admin', async (source, target) => {
    query.mockResolvedValueOnce([{ pwa_code: source }]).mockResolvedValueOnce([{ pwa_code: target }]);
    const res = response();
    await handler('/api/project-evaluation-links')({ user: { role: 'admin' }, body: { contributor_project_code: 'B', primary_project_code: 'A' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(getPool).not.toHaveBeenCalled();
  });

  it('allows same-branch projects to proceed to membership validation', async () => {
    query.mockResolvedValue([{ pwa_code: '1060' }]);
    const connection = { beginTransaction: vi.fn(), query: vi.fn().mockResolvedValue([{ member_role: 'contributor' }]), release: vi.fn() };
    getPool.mockReturnValue({ getConnection: async () => connection });
    const res = response();
    await handler('/api/project-evaluation-links')({ user: { role: 'admin' }, body: { contributor_project_code: 'B', primary_project_code: 'A' } }, res);
    expect(connection.beginTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('rolls back creation of a new contributor in another branch before inserting', async () => {
    const connection = { beginTransaction: vi.fn(), query: vi.fn().mockResolvedValue([[{ pwa_code: '1060' }]]), rollback: vi.fn(), release: vi.fn() };
    getPool.mockReturnValue({ getConnection: async () => connection });
    query.mockResolvedValue([{ pwa_code: '1061' }]);
    const res = response();
    await handler('/api/projects')({ user: { role: 'admin' }, body: { project_code: 'B', project_name: 'B', branch_name: 'branch', pwa_code: '1060', project_type: '1', start_year: 2569, evaluation_mode: 'contributor', primary_project_code: 'A' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.query).toHaveBeenCalledTimes(1);
  });
});
