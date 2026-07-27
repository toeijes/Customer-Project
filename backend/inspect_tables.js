const db = require('./db');
async function run() {
  try {
    await db.initializeDatabase();
    
    const tables = ['projects', 'customer', 'proj_cus'];
    for (const t of tables) {
      console.log(`\n=== TABLE: ${t} ===`);
      const res = await db.query(`SHOW CREATE TABLE \`${t}\``);
      console.log(res[0]['Create Table']);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();

