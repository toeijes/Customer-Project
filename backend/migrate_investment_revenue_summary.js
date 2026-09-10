const db = require('./db');

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_investment_monthly_revenue (
        project_code VARCHAR(50) NOT NULL,
        debt_ym VARCHAR(6) NOT NULL,
        total_usage BIGINT NOT NULL DEFAULT 0,
        total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PRIMARY KEY (project_code, debt_ym),
        KEY idx_investment_revenue_month (debt_ym)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query('TRUNCATE TABLE project_investment_monthly_revenue');
    const startedAt = Date.now();
    await db.query(`
      INSERT INTO project_investment_monthly_revenue (project_code, debt_ym, total_usage, total_amount)
      SELECT
        ec.project_code,
        dt.debt_ym,
        COALESCE(SUM(dt.present_water_usg), 0),
        COALESCE(SUM(dt.total_water_amt), 0)
      FROM eligible_customers ec
      JOIN debt_trn dt ON dt.cust_code = ec.custcode
      GROUP BY ec.project_code, dt.debt_ym
    `);
    console.log(`Investment revenue summary rebuilt in ${Date.now() - startedAt}ms`);
  } finally {
    const pool = db.getPool();
    if (pool) await pool.end();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
