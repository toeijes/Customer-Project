// NULL means follow the project type; explicit choices survive imports/type changes.
const evaluationSql = (alias = 'p') => `(${alias}.project_type IN (1, 2, 3, 4) AND COALESCE(${alias}.evaluation_enabled, 1) = 1)`;
const isEvaluationEnabled = project => [1, 2, 3, 4].includes(Number(project.project_type))
  && (project.evaluation_enabled == null || Number(project.evaluation_enabled) === 1);

async function ensureEvaluationColumn(connection) {
  const [columns] = await connection.query("SHOW COLUMNS FROM projects LIKE 'evaluation_enabled'");
  if (!columns.length) {
    await connection.query('ALTER TABLE projects ADD COLUMN evaluation_enabled TINYINT NULL DEFAULT NULL CHECK (evaluation_enabled IN (0, 1))');
  }
}

module.exports = { evaluationSql, isEvaluationEnabled, ensureEvaluationColumn };
