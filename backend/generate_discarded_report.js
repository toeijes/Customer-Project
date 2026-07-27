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
      cust.fullName as custname,
      p.project_code,
      p.project_name,
      p.project_type,
      c.yearinstall,
      c.contrac_date,
      c.bgncustdt,
      cust.BGN_DATE,
      p.completed_date,
      p.start_year AS proj_year,
      b.branch_name
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
      cust.fullName as custname,
      p.project_code,
      p.project_name,
      p.project_type,
      c.yearinstall,
      c.contrac_date,
      c.bgncustdt,
      cust.BGN_DATE,
      p.completed_date,
      p.start_year AS proj_year,
      b.branch_name
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

  const discarded = {
    missing_date: 0,
    before_window: 0,
    after_window: 0,
    by_project: {}
  };

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
      discarded.missing_date++;
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
      let reason = fiscalYear < startEvalYear ? 'before_window' : 'after_window';
      if (reason === 'before_window') discarded.before_window++;
      if (reason === 'after_window') discarded.after_window++;
      
      const key = `${r.branch_name} | ${r.project_code}`;
      if (!discarded.by_project[key]) {
        discarded.by_project[key] = {
          branch: r.branch_name,
          code: r.project_code,
          name: r.project_name,
          before: 0,
          after: 0
        };
      }
      if (reason === 'before_window') discarded.by_project[key].before++;
      if (reason === 'after_window') discarded.by_project[key].after++;
    }
  }

  // Generate markdown content
  let md = `# รายละเอียดข้อมูลที่ถูกคัดกรองออกสำหรับ เขต 6

ข้อมูลผู้ใช้น้ำจำนวน 138 รายที่หายไปจากยอดสะสมเก่า (16,053) จนเหลือยอดปัจจุบัน (15,915) เป็นผลมาจากการคำนวณข้อมูลใหม่ที่เคร่งครัดเรื่อง **กรอบเวลาประเมินความคุ้มทุน** ของโครงการ 

ในภาพรวม มีผู้ใช้น้ำเขต 6 จำนวน ${discarded.before_window + discarded.after_window + discarded.missing_date} ราย ที่ถูกคัดออกในการประมวลผลล่าสุด ด้วยสาเหตุดังนี้:
- **ติดตั้งมาตรก่อนที่โครงการจะเริ่ม/แล้วเสร็จ:** ${discarded.before_window} ราย
- **ติดตั้งมาตรหลังสิ้นสุดระยะเวลาประเมิน:** ${discarded.after_window} ราย (เกิน 5 ปี สำหรับโครงการหลัก หรือ เกิน 1 ปี สำหรับโครงการเข้าซอย)
- **ไม่ระบุวันที่ติดตั้งมาตร:** ${discarded.missing_date} ราย

(*หมายเหตุ: ยอดเดิม 16,053 อาจะเกิดจากการเหมารวมผู้ใช้น้ำ 138 รายที่ติดตั้งมาตรนอกกรอบเวลานี้เข้าไปด้วย*)

## สรุปจำนวนที่ถูกคัดกรองแยกตามโครงการ

| สาขา | รหัสโครงการ | ชื่อโครงการ | ติดตั้งก่อนเวลา | ติดตั้งหลังหมดระยะเวลา | รวมที่ถูกคัดออก |
|------|-------------|-------------|-----------------|------------------------|-----------------|\n`;

  const sortedKeys = Object.keys(discarded.by_project).sort((a, b) => {
    const totalA = discarded.by_project[a].before + discarded.by_project[a].after;
    const totalB = discarded.by_project[b].before + discarded.by_project[b].after;
    return totalB - totalA;
  });

  for (const key of sortedKeys) {
    const p = discarded.by_project[key];
    const total = p.before + p.after;
    md += `| ${p.branch} | ${p.code} | ${p.name} | ${p.before} | ${p.after} | ${total} |\n`;
  }

  const fs = require('fs');
  fs.writeFileSync('C:/Users/15818/.gemini/antigravity-ide/brain/dbcdb545-3956-48e5-a1c9-808f689fbba6/zone_6_discarded_users.md', md);
  console.log('Artifact created successfully.');
}

run().catch(console.error).finally(() => process.exit());
