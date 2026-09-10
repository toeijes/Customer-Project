const db = require('./db');

async function ensureIndex(tableName, indexName, columns) {
  const indexes = await db.query(`SHOW INDEX FROM \`${tableName}\``);
  if (indexes.some(index => index.Key_name === indexName)) {
    console.log(`${indexName} already exists`);
    return;
  }
  await db.query(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columns})`);
  console.log(`${indexName} created`);
}

(async () => {
  try {
    await ensureIndex('projects', 'idx_projects_investment_scope', '`pwa_code`, `project_type`, `start_year`');
  } finally {
    const pool = db.getPool();
    if (pool) await pool.end();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
