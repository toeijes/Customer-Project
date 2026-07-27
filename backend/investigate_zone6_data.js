const db = require('./db');

async function run() {
  // Method 1: Old way (using branch_name from monthly_actual_users matching pwa_branches)
  const oldRows = await db.query(`
    SELECT SUM(m.actual_users) as old_total
    FROM monthly_actual_users m
    JOIN pwa_branches b ON REPLACE(m.branch_name, 'กปภ.สาขา', '') = REPLACE(b.branch_name, 'กปภ.สาขา', '')
    WHERE b.zone = 6 AND m.project_code NOT LIKE 'PWA6-%' AND m.project_type IN (1, 2, 3, 4)
  `);

  // Method 2: New way (using project_code to get pwa_code from projects, then matching pwa_branches)
  const newRows = await db.query(`
    SELECT SUM(m.actual_users) as new_total
    FROM monthly_actual_users m
    JOIN projects p ON m.project_code = p.project_code
    JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE b.zone = 6 AND m.project_code NOT LIKE 'PWA6-%' AND m.project_type IN (1, 2, 3, 4)
  `);
  
  console.log('Old Total:', oldRows[0].old_total);
  console.log('New Total:', newRows[0].new_total);

  // Find the exact records that exist in Old but not in New
  const mismatch = await db.query(`
    SELECT m.project_code, m.branch_name, m.actual_users, p.pwa_code as project_pwa_code
    FROM monthly_actual_users m
    LEFT JOIN projects p ON m.project_code = p.project_code
    WHERE m.project_code NOT LIKE 'PWA6-%' AND m.project_type IN (1, 2, 3, 4)
    AND m.project_code IN (
      SELECT m2.project_code
      FROM monthly_actual_users m2
      JOIN pwa_branches b2 ON REPLACE(m2.branch_name, 'กปภ.สาขา', '') = REPLACE(b2.branch_name, 'กปภ.สาขา', '')
      WHERE b2.zone = 6
    )
    AND (p.pwa_code IS NULL OR p.pwa_code NOT IN (SELECT pwa_code FROM pwa_branches WHERE zone = 6))
  `);

  console.log('Mismatched Records affecting Zone 6:', mismatch.length);
  mismatch.forEach(r => console.log(r));
}

run().catch(console.error).finally(() => process.exit());
