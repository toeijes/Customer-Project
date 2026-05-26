const mysql = require('mysql2/promise');
require('dotenv').config();

// ตั้งค่า Configuration การเชื่อมต่อ
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

let pool;

// ฟังก์ชันเริ่มต้นสร้าง Connection Pool และตรวจสอบ Database
async function initializeDatabase() {
  try {
    // 1. เชื่อมต่อเซิร์ฟเวอร์หลักก่อน (ยังระบุ Database ไม่ได้เพราะอาจยังไม่มี)
    const connection = await mysql.createConnection(dbConfig);
    
    // 2. สร้าง Database ถ้ายังไม่มี
    const dbName = process.env.DB_DATABASE;
    if (!dbName) throw new Error('DB_DATABASE environment variable is required but not set');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();
    
    console.log(`✓ Database '${dbName}' verified/created successfully.`);

    // 3. สร้าง Connection Pool ตัวจริงที่ผูกกับ Database
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    return pool;
  } catch (error) {
    console.error('✗ Failed to initialize database connection:', error.message);
    throw error;
  }
}

// Helper Query Function
async function query(sql, params) {
  if (!pool) {
    await initializeDatabase();
  }
  const [results] = await pool.query(sql, params);
  return results;
}

module.exports = {
  initializeDatabase,
  query,
  getPool: () => pool
};
