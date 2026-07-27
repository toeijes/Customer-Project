const db = require('./db');
async function run() {
  const dups = await db.query(`
    SELECT REPLACE(branch_name, 'กปภ.สาขา', '') as name, COUNT(*) as count 
    FROM pwa_branches 
    GROUP BY REPLACE(branch_name, 'กปภ.สาขา', '') 
    HAVING COUNT(*) > 1
  `);
  console.log('Duplicate branch names:', dups);
}
run().catch(console.error).finally(() => process.exit());
