process.env.JWT_SECRET = 'test-secret-that-is-not-used-in-production';
process.env.SAFE_LOCAL_MODE = 'true';
process.env.ENABLE_CRON = 'false';
process.env.CORS_ORIGINS = 'https://allowed.example';
process.env.AUTH_RATE_LIMIT_MAX = '2';

const request = require('supertest');
const { app } = require('../server');

describe('API security middleware', () => {
  it('allows CORS preflight only for an allowed origin', async () => {
    const allowed = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://allowed.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://allowed.example');

    const denied = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sets security headers and rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects state-changing requests from an untrusted origin before authentication', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'https://untrusted.example');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Request origin is not allowed.');
  });

  it('rate-limits repeated login attempts without counting preflight requests', async () => {
    await request(app).post('/api/auth/login').send({});
    await request(app).post('/api/auth/login').send({});
    const limited = await request(app).post('/api/auth/login').send({});

    expect(limited.status).toBe(429);
  });
});
