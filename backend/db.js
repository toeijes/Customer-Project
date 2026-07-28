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

// ฟังก์ชันเริ่มต้นสร้าง Connection Pool และตรวจสอบ Database (มีระบบเชื่อมต่อใหม่หากฐานข้อมูลยังไม่พร้อม)
async function initializeDatabase() {
  const maxRetries = 10;
  const retryDelay = 2000; // 2 วินาที
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
        queueLimit: 0,
        dateStrings: true
      });
  
      // 4. Initialize Auth Schema
      const fs = require('fs');
      const path = require('path');
      const authSchemaPath = path.join(__dirname, 'database', 'auth_schema.sql');
      if (fs.existsSync(authSchemaPath)) {
        const authSql = fs.readFileSync(authSchemaPath, 'utf8');
        const statements = authSql.split(';').filter(s => s.trim().length > 0);
        for (const statement of statements) {
          await pool.query(statement);
        }
        console.log(`✓ Auth schema verified/created successfully.`);
      }

      // 5. Initialize Import History Schema
      await pool.query(`
        CREATE TABLE IF NOT EXISTS import_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT,
          user_role VARCHAR(50),
          user_zone INT,
          file_name VARCHAR(255),
          total_records INT,
          imported_records INT,
          skipped_records INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log(`✓ Import history schema verified/created successfully.`);

      // 6. Initialize Water Usage Summary Schema
      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_monthly_usage (
          project_code VARCHAR(50) NOT NULL,
          debt_ym VARCHAR(6) NOT NULL,
          total_bills INT NOT NULL DEFAULT 0,
          total_usage INT NOT NULL DEFAULT 0,
          total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          UNIQUE KEY uq_project_ym (project_code, debt_ym),
          KEY idx_project (project_code),
          KEY idx_debt_ym (debt_ym)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_usage_summary (
          project_code VARCHAR(50) PRIMARY KEY,
          total_users INT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log(`✓ Water usage summary schema verified/created successfully.`);

      // 7. Auto add pwa_code column to projects table if missing
      try {
        await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS pwa_code VARCHAR(20) NULL AFTER branch_name;`);
        await pool.query(`UPDATE projects p JOIN pwa_branches b ON TRIM(p.branch_name) = TRIM(REPLACE(REPLACE(b.branch_name, 'กปภ.สาขา', ''), ' (พ)', '')) SET p.pwa_code = b.pwa_code WHERE p.pwa_code IS NULL;`);
      } catch (e) {
        // Ignore if projects table doesn't exist yet
      }

      return pool;
    } catch (error) {
      console.error(`✗ Connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Waiting ${retryDelay / 1000} seconds before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
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
