const db = require('./db');

const REQUIRED_COLLATION = 'utf8mb4_unicode_ci';

async function getColumn(tableName, columnName) {
  const rows = await db.query(`
    SELECT COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME, EXTRA
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
  `, [tableName, columnName]);
  return rows[0] || null;
}

async function getIndexColumns(tableName) {
  const rows = await db.query(`
    SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `, [tableName]);

  const indexes = new Map();
  rows.forEach(row => {
    if (!indexes.has(row.INDEX_NAME)) indexes.set(row.INDEX_NAME, []);
    indexes.get(row.INDEX_NAME).push(row.COLUMN_NAME);
  });
  return indexes;
}

function hasIndexWithColumns(indexes, columns) {
  return [...indexes.values()].some(indexColumns => (
    indexColumns.length === columns.length
      && indexColumns.every((column, index) => column === columns[index])
  ));
}

async function assertCompatibleCollations() {
  const requiredColumns = [
    ['projects', 'contract_no_normalized'],
    ['proj_cus', 'custcode'],
    ['proj_cus', 'project_no_proj'],
    ['proj_cus', 'project_no_pipe'],
    ['debt_trn', 'cust_code'],
    ['debt_trn', 'debt_ym']
  ];

  for (const [tableName, columnName] of requiredColumns) {
    const column = await getColumn(tableName, columnName);
    if (!column) {
      throw new Error(`Missing required column ${tableName}.${columnName}`);
    }
    if (column.COLLATION_NAME !== REQUIRED_COLLATION) {
      throw new Error(
        `${tableName}.${columnName} uses ${column.COLLATION_NAME || 'no collation'}; `
        + `run the one-time collation migration before adding performance indexes`
      );
    }
  }
}

async function ensureNormalizedContractColumns() {
  const definitions = [
    {
      name: 'project_no_proj_normalized',
      source: 'project_no_proj'
    },
    {
      name: 'project_no_pipe_normalized',
      source: 'project_no_pipe'
    }
  ];
  const additions = [];

  for (const definition of definitions) {
    const existing = await getColumn('proj_cus', definition.name);
    if (!existing) {
      additions.push(`
        ADD COLUMN ${definition.name} VARCHAR(100)
          CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
          GENERATED ALWAYS AS (
            CASE
              WHEN REGEXP_REPLACE(COALESCE(${definition.source}, ''), '[[:space:]]+', '') IN ('', '0') THEN NULL
              ELSE REGEXP_REPLACE(${definition.source}, '[[:space:]]+', '')
            END
          ) STORED INVISIBLE
      `);
      continue;
    }

    if (!String(existing.EXTRA || '').includes('STORED GENERATED')) {
      throw new Error(`proj_cus.${definition.name} exists but is not a STORED generated column`);
    }
  }

  if (additions.length > 0) {
    console.log('Adding normalized generated columns to proj_cus...');
    await db.query(`ALTER TABLE proj_cus ${additions.join(', ')}`);
  }
}

async function ensureIndexes() {
  let indexes = await getIndexColumns('proj_cus');
  const projCusAdditions = [];

  if (!hasIndexWithColumns(indexes, ['project_no_proj_normalized', 'custcode'])) {
    projCusAdditions.push(
      'ADD INDEX idx_proj_cus_proj_norm_cust (project_no_proj_normalized, custcode)'
    );
  }
  if (!hasIndexWithColumns(indexes, ['project_no_pipe_normalized', 'custcode'])) {
    projCusAdditions.push(
      'ADD INDEX idx_proj_cus_pipe_norm_cust (project_no_pipe_normalized, custcode)'
    );
  }
  if (projCusAdditions.length > 0) {
    console.log('Adding normalized contract indexes to proj_cus...');
    await db.query(`ALTER TABLE proj_cus ${projCusAdditions.join(', ')}`);
  }

  indexes = await getIndexColumns('debt_trn');
  if (!hasIndexWithColumns(indexes, ['cust_code', 'debt_ym'])) {
    console.log('Adding composite customer/month index to debt_trn...');
    await db.query(`
      ALTER TABLE debt_trn
      ADD INDEX idx_debt_trn_cust_code_debt_ym (cust_code, debt_ym)
    `);
  }
}

async function ensurePerformanceSchema({ analyze = false } = {}) {
  await assertCompatibleCollations();
  await ensureNormalizedContractColumns();
  await ensureIndexes();

  if (analyze) {
    console.log('Refreshing optimizer statistics for raw PCIS tables...');
    await db.query('ANALYZE TABLE proj_cus, debt_trn');
  }
}

async function run() {
  try {
    await db.initializeDatabase();
    await ensurePerformanceSchema({ analyze: true });
    console.log('Performance schema migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Performance schema migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { ensurePerformanceSchema };
