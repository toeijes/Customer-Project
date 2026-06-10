const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('Altering debt_trn.cust_code collation to utf8mb4_unicode_ci...');
    await db.query('ALTER TABLE debt_trn MODIFY COLUMN cust_code VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✓ Altered debt_trn.cust_code');
    
    console.log('Altering debt_trn.debt_ym collation to utf8mb4_unicode_ci...');
    await db.query('ALTER TABLE debt_trn MODIFY COLUMN debt_ym VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✓ Altered debt_trn.debt_ym');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
