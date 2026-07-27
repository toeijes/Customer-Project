const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query('SHOW FULL PROCESSLIST');
    console.log('Active processes:');
    for (const row of rows) {
      console.log(`ID: ${row.Id}, User: ${row.User}, Host: ${row.Host}, db: ${row.db}, Command: ${row.Command}, Time: ${row.Time}, State: ${row.State}, Info: ${row.Info}`);
      
      // Kill any running SELECT or ALTER queries that have been running for more than 10 seconds, except this one
      if (row.Command === 'Query' && row.Time > 10 && row.Info && !row.Info.includes('PROCESSLIST')) {
        console.log(`Killing process ID ${row.Id}...`);
        await connection.query(`KILL ${row.Id}`);
        console.log(`✓ Killed process ID ${row.Id}`);
      }
    }
    await connection.end();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
