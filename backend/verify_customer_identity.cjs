// Read-only verification: source rows are preserved and each bill joins once.
const mysql = require('mysql2/promise');
const { CUSTOMER_SOURCE, assertCustomerDatesConsistent } = require('./utils/customerIdentity');
require('dotenv').config({ quiet: true });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE, connectTimeout: 15000, dateStrings: true,
  });
  try {
    await connection.query('SET SESSION TRANSACTION READ ONLY');
    await connection.beginTransaction();
    const query = async (sql, params) => (await connection.query(sql, params))[0];
    await assertCustomerDatesConsistent(query);
    const duplicates = await query('SELECT cus_code, COUNT(*) AS source_rows FROM customer GROUP BY cus_code HAVING COUNT(*) > 1 ORDER BY cus_code');
    for (const duplicate of duplicates) {
      const [identity] = await query(`SELECT COUNT(*) AS identity_rows FROM ${CUSTOMER_SOURCE} c WHERE c.cus_code = ?`, [duplicate.cus_code]);
      const [raw] = await query('SELECT COUNT(*) AS bills, COALESCE(SUM(present_water_usg),0) AS usage_total, COALESCE(SUM(total_water_amt),0) AS amount_total FROM debt_trn WHERE cust_code = ?', [duplicate.cus_code]);
      const [joined] = await query(`SELECT COUNT(*) AS bills, COALESCE(SUM(dt.present_water_usg),0) AS usage_total, COALESCE(SUM(dt.total_water_amt),0) AS amount_total FROM debt_trn dt JOIN ${CUSTOMER_SOURCE} c ON c.cus_code = dt.cust_code WHERE dt.cust_code = ?`, [duplicate.cus_code]);
      const passed = identity.identity_rows === 1 && JSON.stringify(raw) === JSON.stringify(joined);
      console.log(JSON.stringify({ ...duplicate, ...identity, raw, joined, passed }));
      if (!passed) throw new Error('Customer identity / billing totals verification failed');
    }
    console.log(`Verified ${duplicates.length} duplicate customer codes without changing source data.`);
    await connection.rollback();
  } finally { await connection.end(); }
}
main().catch(error => { console.error(error.code || '', error.message); process.exitCode = 1; });
