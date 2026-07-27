require('./db.js').initializeDatabase().then(async () => {
    const db = require('./db.js');
    
    // Method 1: Filter by pwa_code matching zone 6 (Dashboard logic)
    const q1 = await db.query(`
        SELECT p.project_code, p.project_name, p.pwa_code, p.branch_name
        FROM projects p
        JOIN pwa_branches b ON p.pwa_code = b.pwa_code
        WHERE b.zone = 6 AND p.project_code NOT LIKE 'PWA6-%' AND p.project_type IN (1, 2, 3, 4)
    `);
    
    // Method 2: Filter by branch_name matching zone 6 branch names (Reports logic)
    const q2 = await db.query(`
        SELECT p.project_code, p.project_name, p.pwa_code, p.branch_name
        FROM projects p
        WHERE p.branch_name IN (
            SELECT branch_name FROM pwa_branches WHERE zone = 6 AND branch_name NOT LIKE '%การประปาส่วนภูมิภาคเขต%'
        ) AND p.project_code NOT LIKE 'PWA6-%' AND p.project_type IN (1, 2, 3, 4)
    `);
    
    console.log("Dashboard method count:", q1.length);
    console.log("Reports method count:", q2.length);
    
    // Find the difference
    const q2Codes = new Set(q2.map(p => p.project_code));
    const diff = q1.filter(p => !q2Codes.has(p.project_code));
    
    console.log("Difference:");
    console.dir(diff, {depth: null});
    
}).then(() => process.exit());
