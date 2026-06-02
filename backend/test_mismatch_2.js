const db = require('./db');

async function test() {
  try {
    await db.initializeDatabase();
    
    // Count total rows in customer
    const totalCustomers = await db.query("SELECT COUNT(*) as count FROM customer");
    console.log('Total customers in database:', totalCustomers[0].count);

    // Count total rows in proj_cus
    const totalProjCus = await db.query("SELECT COUNT(*) as count FROM proj_cus");
    console.log('Total proj_cus connections in database:', totalProjCus[0].count);

    // Let's check if the missing codes are in the database at all (case sensitive/insensitive, whitespace, etc.)
    const codeToCheck = '10601638736';
    const checkExactly = await db.query("SELECT * FROM customer WHERE TRIM(cus_code) = ?", [codeToCheck]);
    console.log(`Checking exact match for code "${codeToCheck}":`, checkExactly);

    const checkLike = await db.query("SELECT * FROM customer WHERE cus_code LIKE ?", [`%${codeToCheck}%`]);
    console.log(`Checking LIKE match for code "${codeToCheck}":`, checkLike);

    // Let's check if there's any customer with code starting with '10601638'
    const startsWith = await db.query("SELECT cus_code, fullName FROM customer WHERE cus_code LIKE '10601638%' LIMIT 5");
    console.log("Customer codes starting with '10601638':", startsWith);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
