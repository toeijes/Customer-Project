const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    console.log('--- PROJECT DETAILS ---');
    const project = await db.query(`
      SELECT * FROM projects WHERE project_code = '1Z.64.1590.2.1.5.00.2';
    `);
    console.log(project);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
