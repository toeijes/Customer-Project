require('./db.js').initializeDatabase().then(async () => {
    const db = require('./db.js');
    const user = await db.query(`SELECT u.*, r.name as role_name FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id LEFT JOIN roles r ON ur.role_id = r.id WHERE u.pwa_username = '15818' OR u.local_username = '15818'`);
    console.log(user);
}).then(() => process.exit());
