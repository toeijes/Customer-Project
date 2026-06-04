require('dotenv').config();
const mysql = require('mysql2/promise');

async function countRows() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
  });

  const tables = ['plan_master', 'customer', 'debt_trn', 'proj_cus'];
  
  try {
    for (const table of tables) {
      const [rows] = await pool.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      console.log(`${table}: ${rows[0].count} rows`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

countRows();
