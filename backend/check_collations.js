const db = require('./db');
async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('--- projects columns collations ---');
    const projectsCols = await db.query("SHOW FULL COLUMNS FROM projects");
    console.log(projectsCols.map(c => ({ Field: c.Field, Collation: c.Collation })));

    console.log('--- eligible_customers columns collations ---');
    const ecCols = await db.query("SHOW FULL COLUMNS FROM eligible_customers");
    console.log(ecCols.map(c => ({ Field: c.Field, Collation: c.Collation })));

    console.log('--- debt_trn columns collations ---');
    const dtCols = await db.query("SHOW FULL COLUMNS FROM debt_trn");
    console.log(dtCols.map(c => ({ Field: c.Field, Collation: c.Collation })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
