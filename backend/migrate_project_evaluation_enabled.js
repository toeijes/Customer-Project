const mysql = require('mysql2/promise');
require('dotenv').config();
const { ensureEvaluationColumn } = require('./utils/projectEvaluation');

async function run() {
  if (process.env.SAFE_LOCAL_MODE === 'true') throw new Error('Migration blocked by SAFE_LOCAL_MODE');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE
  });
  try {
    await ensureEvaluationColumn(connection);
    console.log('projects.evaluation_enabled ready; existing rows follow type defaults. No summaries rebuilt.');
  } finally { await connection.end(); }
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run };
