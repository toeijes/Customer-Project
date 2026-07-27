const db = require('./db');

async function run() {
  try {
    await db.initializeDatabase();
    
    const count = await db.query('SELECT COUNT(*) as count FROM projects');
    console.log('Total projects:', count[0].count);
    
    const samples = await db.query('SELECT * FROM projects LIMIT 5');
    console.log('Sample projects:', samples);
    
    const matchingProjs = await db.query("SELECT COUNT(*) as count FROM projects WHERE project_code NOT LIKE 'PWA6-%' AND project_type IN (1, 2, 3, 4)");
    console.log('Matching projects in where clause:', matchingProjs[0].count);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
