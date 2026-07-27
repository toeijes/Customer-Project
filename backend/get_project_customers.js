const fs = require('fs');
const path = require('path');
const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    const rows = await db.query(`
      SELECT DISTINCT custcode 
      FROM eligible_customers 
      WHERE project_code = '1Z.68.0277.2.1.5.00'
      ORDER BY custcode ASC
    `);
    
    const content = rows.map(r => r.custcode).join('\n');
    const filename = 'project_customers_local.txt'; // If running on server, change to project_customers_server.txt
    
    fs.writeFileSync(path.join(__dirname, filename), content, 'utf8');
    console.log(`✓ Saved ${rows.length} customer codes to ${filename}`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
