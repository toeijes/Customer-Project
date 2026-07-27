const db = require('./db');

async function run() {
  await db.initializeDatabase();
  await db.query(`UPDATE projects SET pwa_code = '5521028' WHERE branch_name = 'บำเหน็จณรงค์' AND (pwa_code IS NULL OR pwa_code = '')`);
  console.log("Updated projects.");
  process.exit();
}
run();
