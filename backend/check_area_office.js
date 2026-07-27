require('./db.js').initializeDatabase().then(() => {
    return require('./db.js').query(`SELECT * FROM pwa_branches WHERE branch_name LIKE "%บำเหน็จณรงค์%"`);
}).then(console.log).then(() => process.exit());
