const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('Trimming projects.contract_no...');
    await db.query('UPDATE projects SET contract_no = TRIM(contract_no)');
    
    console.log('Trimming proj_cus.project_no_proj...');
    await db.query('UPDATE proj_cus SET project_no_proj = TRIM(project_no_proj) WHERE project_no_proj IS NOT NULL');
    
    console.log('Trimming proj_cus.project_no_pipe...');
    await db.query('UPDATE proj_cus SET project_no_pipe = TRIM(project_no_pipe) WHERE project_no_pipe IS NOT NULL');

    console.log('Adding/ensuring indexes on proj_cus(custcode)...');
    try {
      await db.query('ALTER TABLE proj_cus ADD INDEX idx_proj_cus_custcode (custcode)');
      console.log('✓ Added index on proj_cus(custcode)');
    } catch (e) {
      console.log('Index on proj_cus(custcode) might already exist:', e.message);
    }

    console.log('Adding/ensuring indexes on debt_trn(cust_code)...');
    try {
      await db.query('ALTER TABLE debt_trn ADD INDEX idx_debt_trn_custcode (cust_code)');
      console.log('✓ Added index on debt_trn(cust_code)');
    } catch (e) {
      console.log('Index on debt_trn(cust_code) might already exist:', e.message);
    }

    console.log('Adding/ensuring indexes on projects(contract_no)...');
    try {
      await db.query('ALTER TABLE projects ADD INDEX idx_projects_contract_no (contract_no)');
      console.log('✓ Added index on projects(contract_no)');
    } catch (e) {
      console.log('Index on projects(contract_no) might already exist:', e.message);
    }

    console.log('Trimming spaces finished successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to trim spaces:', err);
    process.exit(1);
  }
}

run();
