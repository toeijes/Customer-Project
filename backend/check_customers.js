const db = require('./db');

async function run() {
  const [results] = await db.query(`
    SELECT COUNT(*) as matched_customers
    FROM customer c
    JOIN proj_cus pc ON c.CUS_PRJ_NO = pc.PRJ_NO
    JOIN projects p ON pc.PRJ_CUS_CODE = p.project_code
    JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE b.zone = 6 AND p.project_code NOT LIKE 'PWA6-%' AND p.project_type IN (1, 2, 3, 4)
  `);
  
  const [allZ6] = await db.query(`
    SELECT COUNT(*) as all_customers_zone6
    FROM customer c
    JOIN pwa_branches b ON c.CUS_PWA_CODE = b.pwa_code
    WHERE b.zone = 6
  `);

  const [hasPrj] = await db.query(`
    SELECT COUNT(*) as customers_with_prj
    FROM customer c
    JOIN pwa_branches b ON c.CUS_PWA_CODE = b.pwa_code
    WHERE b.zone = 6 AND c.CUS_PRJ_NO IS NOT NULL AND c.CUS_PRJ_NO != ''
  `);

  console.log('Customers in Zone 6 matching a tracked project:', results[0].matched_customers);
  console.log('All customers in Zone 6:', allZ6[0].all_customers_zone6);
  console.log('Customers in Zone 6 with a PRJ_NO:', hasPrj[0].customers_with_prj);
}
run().catch(console.error).finally(() => process.exit());
