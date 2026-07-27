/**
 * import_pwa_offices.js
 * -----------------------------------------------------------------------
 * สคริปต์นำเข้าข้อมูลสำนักงาน/สาขา กปภ. ทั้ง 10 เขต จากไฟล์ pwa_office_all.xlsx
 * เพื่ออัปเดตตาราง pwa_branches ในฐานข้อมูล
 *
 * วิธีใช้:
 *   node import_pwa_offices.js [--dry-run]
 *
 * Options:
 *   --dry-run  แสดงผลข้อมูลที่จะนำเข้าโดยไม่บันทึกลงฐานข้อมูล
 * -----------------------------------------------------------------------
 * โครงสร้าง pwa_office_all.xlsx (sheet: pwa_office_all)
 *   A = pwa_id     : รหัสสำนักงาน (int, ลำดับในระบบ)
 *   B = pwa_station: ประเภทสาขา (1=สำนักงานประปาเขต, 2=สาขา)
 *   C = pwa_name   : ชื่อสำนักงาน/สาขา (ภาษาไทย)
 *   D = pwa_address: ที่อยู่สำนักงาน (ภาษาไทย)
 *   E = longitude  : พิกัดลองจิจูด
 *   F = latitude   : พิกัดละติจูด
 *   G = pwa_code   : รหัส Business Area (BA) เช่น 5541027
 *   H = zone       : เขต กปภ. (1-10) ← คอลัมน์นี้คือเขตจริง
 *   I = ba         : รหัสอ้างอิงสาขา (4 หลัก เช่น 1166)
 * -----------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

const XLSX_PATH = path.resolve(__dirname, '../pwa_office_all.xlsx');
const DRY_RUN = process.argv.includes('--dry-run');

// ── ยูทิลิตี้อ่าน XLSX ด้วย pure Node.js (ไม่ต้องใช้ package xlsx) ──────────

/**
 * แตกไฟล์ xlsx (zip) และคืนค่า buffer ของไฟล์ที่ต้องการ
 */
function readZipEntry(zipBuffer, targetPath) {
  let offset = 0;
  while (offset < zipBuffer.length - 30) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // Local file header signature

    const flags = zipBuffer.readUInt16LE(offset + 6);
    const compression = zipBuffer.readUInt16LE(offset + 8);
    const compSize = zipBuffer.readUInt32LE(offset + 18);
    const uncompSize = zipBuffer.readUInt32LE(offset + 22);
    const fnLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);
    const fileName = zipBuffer.slice(offset + 30, offset + 30 + fnLen).toString('utf8');

    const dataOffset = offset + 30 + fnLen + extraLen;

    if (fileName === targetPath) {
      const compData = zipBuffer.slice(dataOffset, dataOffset + compSize);
      if (compression === 0) {
        return compData; // Stored (no compression)
      } else if (compression === 8) {
        // Deflated
        const zlib = require('zlib');
        return zlib.inflateRawSync(compData);
      }
    }
    offset = dataOffset + compSize;
  }
  return null;
}

/**
 * แปลง XLSX binary เป็น array ของ object (row data)
 * Returns: Array<{ pwa_id, pwa_station, pwa_name, pwa_address, longitude, latitude, pwa_code, zone, ba }>
 */
function parseXlsx(xlsxPath) {
  const buf = fs.readFileSync(xlsxPath);

  // อ่าน sharedStrings.xml
  const ssRaw = readZipEntry(buf, 'xl/sharedStrings.xml');
  if (!ssRaw) throw new Error('Cannot find xl/sharedStrings.xml in xlsx');

  const ssText = ssRaw.toString('utf8');
  // แยก shared strings โดยใช้ regex (เร็วกว่า XML parse สำหรับไฟล์ใหญ่)
  const sharedStrings = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let siMatch;
  while ((siMatch = siRegex.exec(ssText)) !== null) {
    const siContent = siMatch[1];
    const parts = [];
    let tMatch;
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      parts.push(tMatch[1]);
    }
    sharedStrings.push(parts.join(''));
  }

  // อ่าน sheet1.xml
  const sheetRaw = readZipEntry(buf, 'xl/worksheets/sheet1.xml');
  if (!sheetRaw) throw new Error('Cannot find xl/worksheets/sheet1.xml in xlsx');
  const sheetText = sheetRaw.toString('utf8');

  // parse แถวข้อมูล
  const rows = [];
  const rowRegex = /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  const cellRegex = /<c r="([A-Z]+)(\d+)"([^>]*)><v>([\s\S]*?)<\/v><\/c>/g;

  let rowMatch;
  while ((rowMatch = rowRegex.exec(sheetText)) !== null) {
    const rowNum = parseInt(rowMatch[1], 10);
    if (rowNum === 1) continue; // ข้าม header

    const rowContent = rowMatch[2];
    const cells = {};
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const col = cellMatch[1];      // A, B, C ...
      const attrs = cellMatch[3];    // attributes
      const val = cellMatch[4];      // raw value

      if (attrs.includes('t="s"')) {
        // shared string
        cells[col] = sharedStrings[parseInt(val, 10)] || '';
      } else {
        cells[col] = val;
      }
    }

    if (Object.keys(cells).length === 0) continue;

    rows.push({
      pwa_id: parseInt(cells['A'] || '0', 10) || null,
      pwa_station: parseInt(cells['B'] || '0', 10) || null,
      pwa_name: (cells['C'] || '').trim(),
      pwa_address: (cells['D'] || '').trim(),
      longitude: parseFloat(cells['E'] || '0') || null,
      latitude: parseFloat(cells['F'] || '0') || null,
      pwa_code: (cells['G'] || '').trim(),
      zone: parseInt(cells['H'] || '0', 10) || null,
      ba: (cells['I'] || '').trim(),
    });
  }

  return rows;
}

// ── ฟังก์ชันหลัก ──────────────────────────────────────────────────────────────

async function run() {
  console.log('=======================================================');
  console.log(' Import PWA Offices (All 10 Zones) → pwa_branches');
  console.log('=======================================================');
  if (DRY_RUN) console.log('⚠️  DRY-RUN MODE: No data will be saved to the database.\n');

  // 1. อ่านข้อมูลจาก xlsx
  console.log(`Reading: ${XLSX_PATH}`);
  let rows;
  try {
    rows = parseXlsx(XLSX_PATH);
  } catch (err) {
    console.error('✗ Failed to parse xlsx:', err.message);
    process.exit(1);
  }
  console.log(`✓ Parsed ${rows.length} records from xlsx.\n`);

  // 2. สรุปจำนวนสาขาแยกตามเขต (Column H = zone = เขต กปภ. 1-10)
  const zoneMap = {};
  rows.forEach(r => {
    const z = r.zone || 0;
    if (!zoneMap[z]) zoneMap[z] = 0;
    zoneMap[z]++;
  });
  console.log('Summary by Zone (เขต กปภ. 1-10):');
  Object.keys(zoneMap).sort((a, b) => parseInt(a) - parseInt(b)).forEach(z => {
    console.log(`  เขต ${z}: ${zoneMap[z]} สาขา`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('Sample rows (first 5):');
    rows.slice(0, 5).forEach((r, i) => {
      console.log(`  [${i + 1}]`, JSON.stringify(r, null, 2));
    });
    console.log('\n✓ Dry-run complete. No changes made.');
    process.exit(0);
  }

  // 3. เชื่อมต่อฐานข้อมูล
  await db.initializeDatabase();

  // 4. ตรวจสอบและเพิ่ม columns ที่ขาดหายใน pwa_branches
  console.log('Checking pwa_branches schema...');
  const existingCols = await db.query('DESCRIBE pwa_branches;');
  const colNames = existingCols.map(c => c.Field.toLowerCase());

  const alterStatements = [];

  if (!colNames.includes('zone')) {
    alterStatements.push('ADD COLUMN zone TINYINT NULL COMMENT "เขต กปภ. (1-10)"');
  }
  if (!colNames.includes('pwa_address')) {
    alterStatements.push('ADD COLUMN pwa_address TEXT NULL COMMENT "ที่อยู่สำนักงาน"');
  }
  if (!colNames.includes('longitude')) {
    alterStatements.push('ADD COLUMN longitude DECIMAL(10, 6) NULL COMMENT "พิกัดลองจิจูด"');
  }
  if (!colNames.includes('latitude')) {
    alterStatements.push('ADD COLUMN latitude DECIMAL(10, 6) NULL COMMENT "พิกัดละติจูด"');
  }
  if (!colNames.includes('pwa_code')) {
    alterStatements.push('ADD COLUMN pwa_code VARCHAR(20) NULL COMMENT "รหัส BA เต็ม (เช่น 5521000)"');
  }
  if (!colNames.includes('pwa_station')) {
    alterStatements.push('ADD COLUMN pwa_station INT NULL COMMENT "รหัสสถานีสำนักงาน"');
  }

  if (alterStatements.length > 0) {
    const alterSQL = `ALTER TABLE pwa_branches ${alterStatements.join(', ')};`;
    console.log('Adding missing columns:', alterSQL);
    await db.query(alterSQL);
    console.log(`✓ Added ${alterStatements.length} column(s) to pwa_branches.\n`);
  } else {
    console.log('✓ Schema already up-to-date.\n');
  }

  // 5. Bulk Upsert ข้อมูลสาขาทั้งหมด ด้วย INSERT ... ON DUPLICATE KEY UPDATE ครั้งเดียว
  //    ใช้ branch_name เป็น UNIQUE KEY อยู่แล้ว
  console.log(`Preparing bulk upsert for ${rows.length} records...`);

  const validRows = rows.filter(r => r.pwa_name && r.pwa_name.trim());
  const skipped = rows.length - validRows.length;

  const bulkValues = validRows.map(r => {
    const province = extractProvince(r.pwa_name, r.pwa_address);
    return [
      r.pwa_name,
      province,
      r.ba || null,
      r.zone || null,
      r.pwa_address || null,
      r.longitude || null,
      r.latitude || null,
      r.pwa_code || null,
      r.pwa_id || null,
    ];
  });

  try {
    const result = await db.query(
      `INSERT INTO pwa_branches (branch_name, province, ba, zone, pwa_address, longitude, latitude, pwa_code, pwa_station)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         province    = IF(province IS NULL OR province = '', VALUES(province), province),
         ba          = COALESCE(VALUES(ba), ba),
         zone        = VALUES(zone),
         pwa_address = VALUES(pwa_address),
         longitude   = VALUES(longitude),
         latitude    = VALUES(latitude),
         pwa_code    = VALUES(pwa_code),
         pwa_station = VALUES(pwa_station);`,
      [bulkValues]
    );

    // affectedRows: 1 = inserted, 2 = updated, 0 = no change
    const totalAffected = result.affectedRows;
    console.log(`\n✓ Bulk import completed:`);
    console.log(`  Records processed: ${validRows.length}`);
    console.log(`  Affected rows (inserted+updated): ${totalAffected}`);
    console.log(`  Skipped (empty name): ${skipped}`);
  } catch (err) {
    console.error('✗ Bulk insert failed:', err.message);
    throw err;
  }



  // 6. แสดงสรุปผลสุดท้ายจากฐานข้อมูล
  const summary = await db.query(`
    SELECT zone, COUNT(*) as count
    FROM pwa_branches
    WHERE zone IS NOT NULL
    GROUP BY zone
    ORDER BY zone ASC;
  `);
  console.log('\nDatabase summary after import:');
  summary.forEach(s => console.log(`  เขต ${s.zone}: ${s.count} สาขา`));

  const total = await db.query('SELECT COUNT(*) as total FROM pwa_branches;');
  console.log(`  รวมทั้งหมด: ${total[0].total} สาขา`);

  process.exit(0);
}

/**
 * ดึงชื่อจังหวัดจากที่อยู่สำนักงาน
 * รูปแบบที่อยู่: "97/6 ม.5 ต.บ้านใหญ่ อ.เมือง จ.นครนายก 26000"
 * หรือ          "263 ม.4 ถ.มิตรภาพ ต.จอหอ อ.เมือง จ.นครราชสีมา 30310"
 */
function extractProvince(branchName, address) {
  if (address) {
    // พยายาม match "จ.ชื่อจังหวัด" หรือ "จังหวัดชื่อ"
    const match = address.match(/จ\.([^\d\s,]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    // fallback: หาคำว่า "จังหวัด"
    const match2 = address.match(/จังหวัด\s*([^\d\s,]+)/);
    if (match2 && match2[1]) {
      return match2[1].trim();
    }
  }
  // ถ้าดึงจาก address ไม่ได้ ให้ใช้ branchName เป็น fallback
  return branchName || address || '';
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
