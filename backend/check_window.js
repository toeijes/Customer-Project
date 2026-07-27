const db = require('./db');

function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str) return null;

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts.map(Number);
      if (y > 2500) y -= 543;
      return new Date(y, m - 1, d);
    }
  }
  
  if (str.includes('-')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() > 2500) {
        d.setFullYear(d.getFullYear() - 543);
      }
      return d;
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  
  return null;
}

function getFiscalYear(dateObj) {
  const m = dateObj.getMonth() + 1; // 1-12
  let y = dateObj.getFullYear();
  if (y < 2500) y += 543;
  if (m >= 10) y += 1;
  return y;
}

async function run() {
  const rows = await db.query(`
    SELECT 
      c.custcode,
      p.project_code,
      p.project_type,
      c.yearinstall,
      c.contrac_date,
      c.bgncustdt,
      cust.BGN_DATE,
      p.completed_date,
      p.start_year AS proj_year,
      b.zone
    FROM proj_cus c
    LEFT JOIN customer cust ON c.custcode = cust.cus_code
    JOIN projects p ON TRIM(c.project_no_proj) = TRIM(p.contract_no)
    JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE (c.yearinstall IS NOT NULL OR cust.BGN_DATE IS NOT NULL OR c.bgncustdt IS NOT NULL)
      AND TRIM(p.contract_no) != ''
      AND TRIM(c.project_no_proj) != ''
      AND p.project_code NOT LIKE 'PWA6-%'
      AND p.project_type IN (1, 2, 3, 4)
      AND b.zone = 6
    UNION
    SELECT 
      c.custcode,
      p.project_code,
      p.project_type,
      c.yearinstall,
      c.contrac_date,
      c.bgncustdt,
      cust.BGN_DATE,
      p.completed_date,
      p.start_year AS proj_year,
      b.zone
    FROM proj_cus c
    LEFT JOIN customer cust ON c.custcode = cust.cus_code
    JOIN projects p ON TRIM(c.project_no_pipe) = TRIM(p.contract_no)
    JOIN pwa_branches b ON p.pwa_code = b.pwa_code
    WHERE (c.yearinstall IS NOT NULL OR cust.BGN_DATE IS NOT NULL OR c.bgncustdt IS NOT NULL)
      AND TRIM(p.contract_no) != ''
      AND TRIM(c.project_no_pipe) != ''
      AND p.project_code NOT LIKE 'PWA6-%'
      AND p.project_type IN (1, 2, 3, 4)
      AND b.zone = 6
  `);

  let inWindow = 0;
  let outOfWindow = 0;

  for (const r of rows) {
    let installDate = null;
    
    if (r.yearinstall) {
      const parsed = parseDate(r.yearinstall);
      if (parsed) installDate = parsed;
    }
    
    if (!installDate && r.BGN_DATE) {
      const parsed = parseDate(r.BGN_DATE);
      if (parsed) installDate = parsed;
    }

    if (!installDate && r.bgncustdt) {
      const parsed = parseDate(r.bgncustdt);
      if (parsed) installDate = parsed;
    }

    if (!installDate && r.contrac_date) {
      const parsed = parseDate(r.contrac_date);
      if (parsed) installDate = parsed;
    }

    if (!installDate) {
      continue;
    }

    const fiscalYear = getFiscalYear(installDate);

    let startEvalYear = r.proj_year;
    if (r.completed_date) {
      const compDate = parseDate(r.completed_date);
      if (compDate) {
        startEvalYear = getFiscalYear(compDate);
      }
    }

    let endEvalYear = startEvalYear;
    if (r.project_type === 4) {
      endEvalYear = startEvalYear;
    } else {
      endEvalYear = startEvalYear + 4;
    }

    if (fiscalYear < startEvalYear || fiscalYear > endEvalYear) {
      outOfWindow++;
    } else {
      inWindow++;
    }
  }

  console.log('Zone 6 In Window:', inWindow);
  console.log('Zone 6 Out Of Window:', outOfWindow);
}

run().catch(console.error).finally(() => process.exit());
