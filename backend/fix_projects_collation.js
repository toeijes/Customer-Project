const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('Altering projects.project_code collation to utf8mb4_unicode_ci...');
    // We might need to drop foreign keys or disable key checks if there are any constraints
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.query('ALTER TABLE projects MODIFY COLUMN project_code VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Altered projects.project_code');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
