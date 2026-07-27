const fs = require('fs');
const csv = require('csv-parser');
const db = require('./db');

async function run() {
  await db.initializeDatabase();
  
  // Delete corrupted Zone 7 records
  await db.query(`DELETE FROM plan_master WHERE branch LIKE '%เธ%'`);
  
  let inserted = 0;
  fs.createReadStream('D:/Antigravity/Customer Project/plan _master7.csv')
    .pipe(csv())
    .on('data', async (row) => {
      // The CSV might have a BOM on the first column header (e.g. \uFEFFid)
      const keys = Object.keys(row);
      const idKey = keys.find(k => k.includes('id')) || 'id';
      
      const ba = row['ba'] || null;
      const wwcode = row['wwcode'] || null;
      const branch = row['branch'] || null;
      const proj_year = row['proj_year'] || null;
      const completed_date = row['completed_date'] || null;
      const proj_no = row['proj_no'] || null;
      const contract_no = row['contract_no'] || null;
      const proj_name = row['proj_name'] || null;
      const contract_no_gis = row['contract_no_gis'] || null;
      const proj_name_gis = row['proj_name_gis'] || null;
      
      // budget string might contain commas like "269,000", remove commas before inserting
      let budget = row['budget'] || null;
      if (budget) budget = budget.replace(/,/g, '');
      
      const target = row['target'] || null;
      const type_proj = row['type_proj'] || null;
      const remarks = row['remarks'] || null;
      
      try {
        await db.query(`
          INSERT INTO plan_master 
          (ba, wwcode, branch, proj_year, completed_date, proj_no, contract_no, proj_name, contract_no_gis, proj_name_gis, budget, target, type_proj, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [ba, wwcode, branch, proj_year, completed_date, proj_no, contract_no, proj_name, contract_no_gis, proj_name_gis, budget, target, type_proj, remarks]);
        inserted++;
      } catch (e) {
        console.error('Error inserting row', e.message);
      }
    })
    .on('end', () => {
      console.log(`CSV file successfully processed. Inserted ${inserted} records.`);
    });
}

run().catch(console.error);
