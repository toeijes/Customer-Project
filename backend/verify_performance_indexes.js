const db = require('./db');

function compactExplain(rows) {
  return rows.map(row => ({
    select_type: row.select_type,
    table: row.table,
    type: row.type,
    key: row.key,
    rows: row.rows,
    extra: row.Extra
  }));
}

async function timedQuery(label, sql, params) {
  const startedAt = Date.now();
  const rows = await db.query(sql, params);
  return {
    label,
    duration_ms: Date.now() - startedAt,
    rows
  };
}

async function run() {
  try {
    await db.initializeDatabase();

    const [sampleProject] = await db.query(`
      SELECT p.project_code, p.contract_no_normalized
      FROM projects p
      WHERE p.contract_no_normalized IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM proj_cus pc
          WHERE pc.project_no_proj_normalized = p.contract_no_normalized
             OR pc.project_no_pipe_normalized = p.contract_no_normalized
        )
      LIMIT 1
    `);
    if (!sampleProject) throw new Error('No project/customer contract match found for verification');

    const oldResult = await timedQuery('function_wrapped_lookup', `
      SELECT COUNT(DISTINCT Id) AS matched_rows
      FROM proj_cus
      WHERE REGEXP_REPLACE(COALESCE(project_no_proj, ''), '[[:space:]]+', '') = ?
         OR REGEXP_REPLACE(COALESCE(project_no_pipe, ''), '[[:space:]]+', '') = ?
    `, [sampleProject.contract_no_normalized, sampleProject.contract_no_normalized]);

    const newResult = await timedQuery('indexed_normalized_lookup', `
      WITH matched_proj_cus AS (
        SELECT Id
        FROM proj_cus
        WHERE project_no_proj_normalized = ?

        UNION

        SELECT Id
        FROM proj_cus
        WHERE project_no_pipe_normalized = ?
      )
      SELECT COUNT(*) AS matched_rows
      FROM matched_proj_cus
    `, [sampleProject.contract_no_normalized, sampleProject.contract_no_normalized]);

    const oldCount = Number(oldResult.rows[0].matched_rows);
    const newCount = Number(newResult.rows[0].matched_rows);
    if (oldCount !== newCount) {
      throw new Error(`Customer match count changed: old=${oldCount}, new=${newCount}`);
    }

    const projectExplain = await db.query(`
      EXPLAIN
      WITH matched_proj_cus AS (
        SELECT pc.Id
        FROM projects p
        JOIN proj_cus pc
          ON pc.project_no_proj_normalized = p.contract_no_normalized
        WHERE p.project_code = ?

        UNION

        SELECT pc.Id
        FROM projects p
        JOIN proj_cus pc
          ON pc.project_no_pipe_normalized = p.contract_no_normalized
        WHERE p.project_code = ?
      )
      SELECT pc.custcode
      FROM matched_proj_cus matched
      JOIN proj_cus pc ON pc.Id = matched.Id
    `, [sampleProject.project_code, sampleProject.project_code]);

    const [sampleUsageProject] = await db.query(`
      SELECT project_code
      FROM eligible_customers
      GROUP BY project_code
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `);
    const debtExplain = sampleUsageProject
      ? await db.query(`
          EXPLAIN
          SELECT ec.custcode, SUM(dt.present_water_usg) AS total_usage
          FROM eligible_customers ec
          JOIN projects p ON ec.project_code = p.project_code
          LEFT JOIN debt_trn dt
            ON ec.custcode = dt.cust_code
           AND dt.debt_ym >= CONCAT(p.completion_year - 1, '10')
           AND dt.debt_ym <= CONCAT(p.completion_year + 5, '09')
          WHERE ec.project_code = ?
          GROUP BY ec.custcode
        `, [sampleUsageProject.project_code])
      : [];

    const projectPlan = compactExplain(projectExplain);
    const debtPlan = compactExplain(debtExplain);
    const expectedProjectIndexes = new Set([
      'idx_proj_cus_proj_norm_cust',
      'idx_proj_cus_pipe_norm_cust'
    ]);
    const usedProjectIndexes = new Set(projectPlan.map(row => row.key).filter(Boolean));
    if (![...expectedProjectIndexes].every(index => usedProjectIndexes.has(index))) {
      throw new Error('Project lookup plan is not using both normalized contract indexes');
    }
    if (sampleUsageProject && !debtPlan.some(row => row.key === 'idx_debt_trn_cust_code_debt_ym')) {
      throw new Error('Debt lookup plan is not using idx_debt_trn_cust_code_debt_ym');
    }

    console.log(JSON.stringify({
      success: true,
      sample_project: sampleProject.project_code,
      matched_rows: newCount,
      timings_ms: {
        function_wrapped_lookup: oldResult.duration_ms,
        indexed_normalized_lookup: newResult.duration_ms
      },
      project_plan: projectPlan,
      debt_plan: debtPlan
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
    process.exit(1);
  }
}

run();
