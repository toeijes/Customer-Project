const db = require('./db');

async function check() {
  try {
    await db.initializeDatabase();
    
    console.log('--- Sample projects in project_yearly_performance ---');
    const yp = await db.query('SELECT * FROM project_yearly_performance LIMIT 20;');
    console.log(yp);

    console.log('--- Sample projects in monthly_actual_users ---');
    const ma = await db.query('SELECT * FROM monthly_actual_users LIMIT 20;');
    console.log(ma);

    console.log('--- Count of project_yearly_performance by fiscal_year ---');
    const countYp = await db.query('SELECT fiscal_year, COUNT(*), SUM(actual_users) FROM project_yearly_performance GROUP BY fiscal_year;');
    console.log(countYp);

    console.log('--- Count of monthly_actual_users by fiscal_year ---');
    const countMa = await db.query('SELECT fiscal_year, COUNT(*), SUM(actual_users) FROM monthly_actual_users GROUP BY fiscal_year;');
    console.log(countMa);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

check();
