const db = require('./db');

async function test() {
  try {
    console.log('Testing MySQL query execution...');
    await db.initializeDatabase();
    
    console.log('Inserting test row...');
    const result = await db.query(
      `INSERT INTO projects (project_code, contract_no, branch_name, project_name, project_type, start_year, completion_year, budget, target_users)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ['TEST-001', 'TEST-CONT', 'ขอนแก่น', 'Test Project Name', 1, 2564, 2564, 1000000.00, 100]
    );
    console.log('✓ Insert successful, result:', result);
    
    const rows = await db.query('SELECT * FROM projects;');
    console.log('✓ SELECT successful, rows:', rows);
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Test failed with error:', error);
    process.exit(1);
  }
}

test();
