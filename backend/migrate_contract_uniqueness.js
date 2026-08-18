const db = require('./db');

const CONTRACT_SQL = "REGEXP_REPLACE(contract_no, '[[:space:]]+', '')";

async function columnExists(tableName, columnName) {
  const rows = await db.query(`
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
  `, [tableName, columnName]);
  return rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await db.query(`
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    LIMIT 1
  `, [tableName, indexName]);
  return rows.length > 0;
}

async function tableExists(tableName) {
  const rows = await db.query(`
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1
  `, [tableName]);
  return rows.length > 0;
}

async function findDuplicates() {
  return db.query(`
    SELECT ${CONTRACT_SQL} AS contract_no, COUNT(*) AS project_count,
           GROUP_CONCAT(project_code ORDER BY project_code SEPARATOR ', ') AS project_codes
    FROM projects
    WHERE ${CONTRACT_SQL} NOT IN ('', '0')
    GROUP BY ${CONTRACT_SQL}
    HAVING COUNT(*) > 1
    ORDER BY contract_no
  `);
}

async function run() {
  await db.initializeDatabase();

  const duplicates = await findDuplicates();
  if (duplicates.length > 0) {
    console.error('Contract uniqueness migration stopped because duplicates still exist:');
    console.error(JSON.stringify(duplicates, null, 2));
    process.exitCode = 1;
    return;
  }

  await db.query(`
    UPDATE projects
    SET contract_no = CASE
      WHEN ${CONTRACT_SQL} IN ('', '0') THEN ''
      ELSE ${CONTRACT_SQL}
    END
  `);

  if (await tableExists('plan_master')) {
    await db.query(`
      UPDATE plan_master
      SET contract_no = CASE
            WHEN contract_no IS NULL THEN NULL
            WHEN REGEXP_REPLACE(contract_no, '[[:space:]]+', '') IN ('', '0') THEN ''
            ELSE REGEXP_REPLACE(contract_no, '[[:space:]]+', '')
          END,
          contract_no_gis = CASE
            WHEN contract_no_gis IS NULL THEN NULL
            WHEN REGEXP_REPLACE(contract_no_gis, '[[:space:]]+', '') IN ('', '0') THEN ''
            ELSE REGEXP_REPLACE(contract_no_gis, '[[:space:]]+', '')
          END
    `);
  }

  if (!await columnExists('projects', 'contract_no_normalized')) {
    await db.query(`
      ALTER TABLE projects
      ADD COLUMN contract_no_normalized VARCHAR(100)
        GENERATED ALWAYS AS (
          CASE
            WHEN REGEXP_REPLACE(contract_no, '[[:space:]]+', '') IN ('', '0') THEN NULL
            ELSE REGEXP_REPLACE(contract_no, '[[:space:]]+', '')
          END
        ) STORED AFTER contract_no
    `);
  }

  if (!await indexExists('projects', 'uq_projects_contract_no_normalized')) {
    await db.query(`
      ALTER TABLE projects
      ADD UNIQUE INDEX uq_projects_contract_no_normalized (contract_no_normalized)
    `);
  }

  const remainingDuplicates = await findDuplicates();
  const [summary] = await db.query(`
    SELECT
      SUM(contract_no = '') AS projects_without_contract,
      SUM(contract_no_normalized IS NOT NULL) AS projects_with_contract
    FROM projects
  `);

  console.log(JSON.stringify({
    success: remainingDuplicates.length === 0,
    remainingDuplicates,
    summary
  }, null, 2));
}

run()
  .catch((error) => {
    console.error('Contract uniqueness migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  });
