const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
  });
  await connection.query(`CREATE TABLE IF NOT EXISTS project_evaluation_groups (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    primary_project_code VARCHAR(50) NOT NULL,
    group_name VARCHAR(255) NULL,
    created_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_evaluation_group_primary (primary_project_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await connection.query(`CREATE TABLE IF NOT EXISTS project_evaluation_group_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    group_id BIGINT UNSIGNED NOT NULL,
    project_code VARCHAR(50) NOT NULL,
    member_role ENUM('primary', 'contributor') NOT NULL,
    relationship_reason VARCHAR(100) NULL,
    note VARCHAR(500) NULL,
    created_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_evaluation_member_project (project_code),
    UNIQUE KEY uq_evaluation_member_group_project (group_id, project_code),
    KEY idx_evaluation_member_group (group_id),
    CONSTRAINT fk_evaluation_member_group FOREIGN KEY (group_id)
      REFERENCES project_evaluation_groups(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await connection.query('ALTER TABLE project_evaluation_groups MODIFY COLUMN created_by VARCHAR(36) NULL');
  await connection.query('ALTER TABLE project_evaluation_group_members MODIFY COLUMN created_by VARCHAR(36) NULL');
  await connection.end();
  console.log('Project evaluation link tables are ready.');
}

migrate().catch(error => { console.error(error); process.exitCode = 1; });
