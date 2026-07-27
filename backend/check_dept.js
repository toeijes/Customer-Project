require('./db.js').initializeDatabase().then(() => {
    return require('./db.js').query('SELECT created_at FROM import_history WHERE table_name = "debt_trn" ORDER BY id DESC LIMIT 5');
}).then(console.log).then(() => process.exit());
