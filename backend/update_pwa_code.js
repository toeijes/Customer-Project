require('./db.js').initializeDatabase().then(async () => {
    const db = require('./db.js');
    await db.query(`UPDATE projects SET pwa_code = '5521029' WHERE branch_name LIKE '%บำเหน็จณรงค์%'`);
    console.log("Updated projects table for บำเหน็จณรงค์ to use pwa_code 5521029.");
}).then(() => process.exit());
