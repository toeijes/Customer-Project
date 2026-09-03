const { v4: uuidv4 } = require('uuid');

const PROJECT_TYPES = new Set([1, 2, 3, 4]);
const NUMERIC_PROJECT_FIELDS = new Set([
  'project_type', 'start_year', 'completion_year', 'budget', 'target_users'
]);

const toText = (value) => value === null || value === undefined ? '' : String(value).trim();
const toNullableText = (value) => {
  const text = toText(value);
  return text || null;
};
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const sanitizeContractNo = (value) => {
  const compact = String(value ?? '').replace(/\s+/gu, '');
  return compact === '0' ? '' : compact;
};
const normalizeBranch = (value) => toText(value)
  .replace(/^กปภ\.สาขา\s*/u, '')
  .replace(/\s+\(พ\)$/u, '')
  .trim();

function calculateCompletionYear(completedDate, startYear) {
  const fallback = Math.trunc(toNumber(startYear, 0));
  const parts = toText(completedDate).split('/');
  if (parts.length !== 3) return fallback;

  const month = Number.parseInt(parts[1], 10);
  const year = Number.parseInt(parts[2], 10);
  if (!Number.isFinite(month) || !Number.isFinite(year)) return fallback;
  return month >= 10 ? year + 1 : year;
}

function equalValues(left, right, numeric = false) {
  if (left === null || left === undefined || left === '') return right === null || right === undefined || right === '';
  if (right === null || right === undefined || right === '') return false;
  if (numeric) return Number(left) === Number(right);
  return String(left) === String(right);
}

function buildProjectFromMaster(master, existing, branchPwaCodes) {
  const branchName = toText(master.branch);
  const normalizedBranch = normalizeBranch(branchName);
  return {
    project_code: toText(master.proj_no),
    contract_no: sanitizeContractNo(master.contract_no),
    branch_name: branchName,
    pwa_code: branchPwaCodes.get(normalizedBranch) || existing?.pwa_code || null,
    project_name: toText(master.proj_name),
    project_type: Math.trunc(toNumber(master.type_proj)),
    start_year: Math.trunc(toNumber(master.proj_year)),
    completion_year: calculateCompletionYear(master.completed_date, master.proj_year),
    completed_date: toNullableText(master.completed_date),
    budget: toNumber(master.budget),
    target_users: Math.trunc(toNumber(master.target)),
    remarks: toNullableText(master.remarks)
  };
}

function collectChanges(existing, next) {
  if (!existing) return Object.keys(next).filter(key => key !== 'project_code');
  return Object.keys(next).filter((key) => {
    if (key === 'project_code') return false;
    return !equalValues(existing[key], next[key], NUMERIC_PROJECT_FIELDS.has(key));
  });
}

async function ensureSyncLogTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS plan_master_sync_runs (
      id CHAR(36) PRIMARY KEY,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      status VARCHAR(20) NOT NULL,
      source_rows INT NOT NULL DEFAULT 0,
      inserted_rows INT NOT NULL DEFAULT 0,
      updated_rows INT NOT NULL DEFAULT 0,
      unchanged_rows INT NOT NULL DEFAULT 0,
      skipped_rows INT NOT NULL DEFAULT 0,
      conflict_rows INT NOT NULL DEFAULT 0,
      details JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS plan_master_sync_changes (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      run_id CHAR(36) NOT NULL,
      project_code VARCHAR(50) NOT NULL,
      change_type VARCHAR(20) NOT NULL,
      changed_fields JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_plan_master_sync_changes_run_id (run_id),
      KEY idx_plan_master_sync_changes_project_code (project_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function loadSyncData(connection, projectCode = null) {
  const params = [];
  let projectFilter = '';
  if (projectCode) {
    projectFilter = ' AND TRIM(pm.proj_no) = ?';
    params.push(projectCode);
  }

  const [masters] = await connection.query(`
    SELECT pm.proj_no, pm.contract_no, pm.branch, pm.proj_name, pm.type_proj,
           pm.proj_year, pm.completed_date, pm.budget, pm.target, pm.remarks
    FROM plan_master pm
    WHERE TRIM(COALESCE(pm.proj_no, '')) <> ''
      AND pm.proj_no NOT LIKE 'PWA6-%'
      AND CAST(COALESCE(pm.type_proj, 0) AS SIGNED) IN (1, 2, 3, 4)
      ${projectFilter}
    ORDER BY pm.proj_no
  `, params);
  const [projects] = await connection.query(`
    SELECT project_code, contract_no, branch_name, pwa_code, project_name, project_type,
           start_year, completion_year, completed_date, budget, target_users, remarks
    FROM projects
  `);
  const [branches] = await connection.query('SELECT branch_name, pwa_code FROM pwa_branches');
  return { masters, projects, branches };
}

async function synchronizePlanMaster({ connection, dryRun = false, projectCode = null }) {
  const { masters, projects, branches } = await loadSyncData(connection, projectCode);
  const projectByCode = new Map(projects.map(project => [toText(project.project_code), project]));
  const branchPwaCodes = new Map(branches.map(branch => [normalizeBranch(branch.branch_name), branch.pwa_code]));
  const masterByCode = new Map();
  const contractOwners = new Map();
  const conflicts = [];

  for (const master of masters) {
    const code = toText(master.proj_no);
    if (masterByCode.has(code)) {
      conflicts.push({ project_code: code, reason: 'duplicate_project_code_in_plan_master' });
      continue;
    }
    masterByCode.set(code, master);
    const contractNo = sanitizeContractNo(master.contract_no);
    if (contractNo) {
      const priorOwner = contractOwners.get(contractNo);
      if (priorOwner && priorOwner !== code) {
        conflicts.push({ project_code: code, contract_no: contractNo, reason: 'duplicate_contract_no_in_plan_master', conflicting_project_code: priorOwner });
      } else {
        contractOwners.set(contractNo, code);
      }
    }
  }

  const conflictCodes = new Set(conflicts.map(conflict => conflict.project_code));
  let plans = [];
  for (const [code, master] of masterByCode) {
    if (conflictCodes.has(code)) continue;
    const existing = projectByCode.get(code);
    const next = buildProjectFromMaster(master, existing, branchPwaCodes);
    if (!next.project_name || !next.branch_name || !PROJECT_TYPES.has(next.project_type) || !next.start_year) {
      conflicts.push({ project_code: code, reason: 'missing_required_project_data' });
      continue;
    }

    plans.push({ code, existing, next, changedFields: collectChanges(existing, next) });
  }

  // A contract can currently belong to another project only when that other project
  // is not also moving to a different contract in this same synchronization.
  const plannedByCode = new Map(plans.map(plan => [plan.code, plan]));
  plans = plans.filter((plan) => {
    if (!plan.next.contract_no) return true;
    const conflictingProject = projects.find(project => (
      sanitizeContractNo(project.contract_no) === plan.next.contract_no && toText(project.project_code) !== plan.code
    ));
    if (!conflictingProject) return true;

    const replacement = plannedByCode.get(toText(conflictingProject.project_code));
    if (replacement && replacement.next.contract_no !== plan.next.contract_no) return true;

    conflicts.push({
      project_code: plan.code,
      contract_no: plan.next.contract_no,
      reason: 'contract_no_used_by_another_project',
      conflicting_project_code: conflictingProject.project_code
    });
    return false;
  });

  const summary = {
    source_rows: masters.length,
    inserted_rows: plans.filter(plan => !plan.existing).length,
    updated_rows: plans.filter(plan => plan.existing && plan.changedFields.length > 0).length,
    unchanged_rows: plans.filter(plan => plan.existing && plan.changedFields.length === 0).length,
    skipped_rows: conflicts.length,
    conflict_rows: conflicts.length,
    conflicts
  };

  if (dryRun) return { ...summary, dry_run: true };
  if (conflicts.length > 0) {
    const error = new Error('Plan master sync stopped because conflicts were found. Run with --dry-run to review them.');
    error.summary = summary;
    throw error;
  }

  const runId = uuidv4();
  await connection.query(`
    INSERT INTO plan_master_sync_runs (id, status, source_rows, inserted_rows, updated_rows, unchanged_rows, skipped_rows, conflict_rows)
    VALUES (?, 'RUNNING', ?, ?, ?, ?, ?, ?)
  `, [runId, summary.source_rows, summary.inserted_rows, summary.updated_rows, summary.unchanged_rows, summary.skipped_rows, summary.conflict_rows]);

  // The normalized contract number has a unique index. Clear changed values first
  // so that contract numbers can move between projects within one transaction.
  for (const plan of plans) {
    if (plan.existing && sanitizeContractNo(plan.existing.contract_no) !== plan.next.contract_no) {
      await connection.query('UPDATE projects SET contract_no = ? WHERE project_code = ?', ['', plan.code]);
    }
  }

  for (const plan of plans) {
    if (!plan.existing) {
      await connection.query(`
        INSERT INTO projects
          (project_code, contract_no, branch_name, pwa_code, project_name, project_type, start_year, completion_year, completed_date, budget, target_users, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        plan.next.project_code, plan.next.contract_no, plan.next.branch_name, plan.next.pwa_code,
        plan.next.project_name, plan.next.project_type, plan.next.start_year, plan.next.completion_year,
        plan.next.completed_date, plan.next.budget, plan.next.target_users, plan.next.remarks
      ]);
    } else if (plan.changedFields.length > 0) {
      await connection.query(`
        UPDATE projects
        SET contract_no = ?, branch_name = ?, pwa_code = ?, project_name = ?, project_type = ?,
            start_year = ?, completion_year = ?, completed_date = ?, budget = ?, target_users = ?, remarks = ?
        WHERE project_code = ?
      `, [
        plan.next.contract_no, plan.next.branch_name, plan.next.pwa_code, plan.next.project_name,
        plan.next.project_type, plan.next.start_year, plan.next.completion_year, plan.next.completed_date,
        plan.next.budget, plan.next.target_users, plan.next.remarks, plan.next.project_code
      ]);
    }

    if (plan.changedFields.length > 0 || !plan.existing) {
      const fields = Object.fromEntries(plan.changedFields.map(field => [field, {
        from: plan.existing ? plan.existing[field] ?? null : null,
        to: plan.next[field] ?? null
      }]));
      await connection.query(`
        INSERT INTO plan_master_sync_changes (run_id, project_code, change_type, changed_fields)
        VALUES (?, ?, ?, ?)
      `, [runId, plan.code, plan.existing ? 'UPDATE' : 'INSERT', JSON.stringify(fields)]);
    }
  }

  await connection.query(`
    UPDATE plan_master_sync_runs
    SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, details = ?
    WHERE id = ?
  `, [JSON.stringify(summary), runId]);

  await connection.query(`
    INSERT INTO system_logs (user_id, username, action, target, target_id, details, ip_address)
    VALUES (NULL, 'System', 'SYNC_PLAN_MASTER', 'PROJECTS', NULL, ?, NULL)
  `, [JSON.stringify({ run_id: runId, ...summary })]);

  return { ...summary, run_id: runId, dry_run: false };
}

module.exports = {
  ensureSyncLogTables,
  synchronizePlanMaster,
  calculateCompletionYear,
  equalValues,
  sanitizeContractNo
};
