require('dotenv').config();
const db = require('./db');

async function check() {
  try {
    await db.initializeDatabase();
    
    console.log('--- plan_master columns ---');
    const cols = await db.query('DESCRIBE plan_master;');
    console.log(cols);

    console.log('--- Sample data from plan_master ---');
    const sample = await db.query('SELECT DISTINCT branch, ba FROM plan_master LIMIT 10;');
    console.log(sample);

    console.log('--- Checking pwa_branches columns ---');
    const colsBranches = await db.query('DESCRIBE pwa_branches;');
    console.log(colsBranches);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

check();
