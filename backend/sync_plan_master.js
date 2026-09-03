const db = require('./db');
const { ensureSyncLogTables, synchronizePlanMaster } = require('./utils/planMasterSync');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const apply = args.has('--apply');
const projectCodeIndex = process.argv.indexOf('--project-code');
const projectCode = projectCodeIndex >= 0 ? String(process.argv[projectCodeIndex + 1] || '').trim() : null;

if (dryRun === apply) {
  console.error('Use exactly one mode: --dry-run or --apply');
  process.exit(1);
}
if (db.isSafeLocalMode()) {
  console.error('SAFE_LOCAL_MODE is enabled: plan master synchronization is blocked.');
  process.exit(1);
}

async function run() {
  await db.initializeDatabase();
  const connection = await db.getPool().getConnection();
  try {
    if (dryRun) {
      const result = await synchronizePlanMaster({ connection, dryRun: true, projectCode });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    await ensureSyncLogTables(connection);
    await connection.beginTransaction();
    const result = await synchronizePlanMaster({ connection, projectCode });
    await connection.commit();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    try { await connection.rollback(); } catch { /* no transaction to roll back */ }
    console.error(error.message);
    if (error.summary) console.error(JSON.stringify(error.summary, null, 2));
    process.exitCode = 1;
  } finally {
    connection.release();
    await db.getPool().end();
  }
}

run();
