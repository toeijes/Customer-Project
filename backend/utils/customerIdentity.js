// Meter replacements are history, not additional water users. This derived
// relation has exactly one row per customer code, without changing source data.
// Meter fields list all known values; without an effective date we cannot tell
// which meter is current. Conflicting readings are intentionally left NULL.
const CUSTOMER_SOURCE = `(
  SELECT cus_code,
    MIN(fullName) AS fullName, MIN(status) AS status,
    GROUP_CONCAT(DISTINCT meter_no ORDER BY meter_no SEPARATOR ' / ') AS meter_no,
    CASE WHEN COUNT(DISTINCT present_meter_count) = 1 THEN MIN(present_meter_count) END AS present_meter_count,
    MIN(use_Name) AS use_Name,
    GROUP_CONCAT(DISTINCT brandName ORDER BY brandName SEPARATOR ' / ') AS brandName,
    GROUP_CONCAT(DISTINCT sizeName ORDER BY sizeName SEPARATOR ' / ') AS sizeName,
    MIN(full_address) AS full_address,
    MIN(LATITUDE) AS LATITUDE, MIN(LONGITUDE) AS LONGITUDE,
    CASE WHEN COUNT(DISTINCT BGN_DATE) <= 1 THEN MIN(BGN_DATE) END AS BGN_DATE,
    COUNT(DISTINCT BGN_DATE) > 1 AS bgn_date_conflict
  FROM customer GROUP BY cus_code
)`;

function uniqueProjectCustomers(rows, { projectKey = 'project_code', customerKey = 'custcode' } = {}) {
  const seen = new Set();
  return rows.filter(row => {
    const code = row[customerKey];
    if (code === null || code === undefined || String(code).trim() === '') return false;
    const key = JSON.stringify([row[projectKey] ?? null, String(code)]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function assertCustomerDatesConsistent(query) {
  const conflicts = await query(`
    SELECT cus_code FROM customer GROUP BY cus_code
    HAVING COUNT(DISTINCT BGN_DATE) > 1 LIMIT 1
  `);
  if (conflicts.length) {
    const error = new Error('พบรหัสผู้ใช้น้ำที่มีวันที่เริ่มใช้น้ำขัดแย้งกัน กรุณาตรวจข้อมูล customer ก่อนประมวลผล');
    error.code = 'CUSTOMER_DATE_CONFLICT';
    throw error;
  }
}

module.exports = { CUSTOMER_SOURCE, uniqueProjectCustomers, assertCustomerDatesConsistent };
