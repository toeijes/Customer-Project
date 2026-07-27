require('./db.js').initializeDatabase().then(() => {
    return require('./db.js').query(`SELECT * FROM pwa_branches WHERE pwa_code = '5521029'`);
}).then(console.log).then(() => process.exit());
