const db = require('./db');
async function test() {
  const years = await db.query(`
    SELECT p.project_code, p.start_year, p.completed_date, y.fiscal_year, y.actual_users
    FROM project_yearly_performance y 
    JOIN projects p ON y.project_code = p.project_code 
    WHERE y.fiscal_year > p.start_year + 5
    LIMIT 10
  `);
  console.log(years);
  process.exit();
}
test();
