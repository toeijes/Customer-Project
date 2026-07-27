const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('--- debt_trn columns ---');
    const cols = await db.query('DESCRIBE debt_trn');
    console.log(cols.map(c => ({ Field: c.Field, Type: c.Type })));

    console.log('--- Sample 5 rows ---');
    const sample = await db.query('SELECT * FROM debt_trn LIMIT 5');
    console.log(sample);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
