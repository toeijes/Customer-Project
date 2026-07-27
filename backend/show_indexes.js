const db = require('./db');
async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('--- proj_cus indexes ---');
    const idxProjCus = await db.query('SHOW INDEX FROM proj_cus');
    console.log(idxProjCus.map(i => ({ Table: i.Table, Key_name: i.Key_name, Column_name: i.Column_name })));

    console.log('--- debt_trn indexes ---');
    const idxDebtTrn = await db.query('SHOW INDEX FROM debt_trn');
    console.log(idxDebtTrn.map(i => ({ Table: i.Table, Key_name: i.Key_name, Column_name: i.Column_name })));

    console.log('--- projects indexes ---');
    const idxProjects = await db.query('SHOW INDEX FROM projects');
    console.log(idxProjects.map(i => ({ Table: i.Table, Key_name: i.Key_name, Column_name: i.Column_name })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
