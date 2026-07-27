const fs = require('fs');
let code = fs.readFileSync('d:/Antigravity/Customer Project/backend/update_data.js', 'utf8');

// 1. Add projectEarlyActuals
code = code.replace(
  'const projectActuals = {}; // project_code -> year -> month_number -> count',
  'const projectActuals = {}; // project_code -> year -> month_number -> count\n    const projectEarlyActuals = {}; // project_code -> year -> month_number -> count'
);

// 2. Fix isAfter filter to keep early users
code = code.replace(
  '      // Only include customer if bgnDate is after project completion date\n      if (!bgnDate || !compDate || !isAfter(bgnDate, compDate)) {\n        return; // skip this user\n      }',
  '      // Only include customer if bgnDate is after project completion date\n      if (!bgnDate || !compDate) {\n        return; // skip if dates are missing\n      }\n      const isEarly = !isAfter(bgnDate, compDate);'
);

// 3. Skip future and add to early
code = code.replace(
  '      if (isFuture) {\n        return; // skip future connection\n      }',
  '      if (isFuture) {\n        return; // skip future connection\n      }\n\n      if (isEarly) {\n        if (!projectEarlyActuals[code]) projectEarlyActuals[code] = {};\n        if (!projectEarlyActuals[code][year]) projectEarlyActuals[code][year] = {};\n        projectEarlyActuals[code][year][month] = (projectEarlyActuals[code][year][month] || 0) + 1;\n        return; // skip early users from eligible_customers and normal actuals\n      }'
);

// 4. Initialize early in consolidatedMonthly
code = code.replace(
  '                monthNum: monthNum,\n                count: count\n              };',
  '                monthNum: monthNum,\n                count: count,\n                early: 0\n              };'
);

// 5. Consolidate early actuals
const beforeConsolidateMap = '    const monthlyActualUsersRows = Object.values(consolidatedMonthly).map(item => [';
const consolidateEarlyLogic = `    for (const code in projectEarlyActuals) {
      const pInfo = projectsMap[code];
      if (!pInfo) continue;
      for (const yearStr in projectEarlyActuals[code]) {
        const year = parseInt(yearStr);
        for (const monthStr in projectEarlyActuals[code][year]) {
          const monthNum = parseInt(monthStr);
          const count = projectEarlyActuals[code][year][monthNum];
          if (count > 0) {
            const normCode = code.trim().toUpperCase();
            const key = \`\${normCode}-\${year}-\${monthNum}\`;
            if (consolidatedMonthly[key]) {
              consolidatedMonthly[key].early = (consolidatedMonthly[key].early || 0) + count;
            } else {
              consolidatedMonthly[key] = {
                code: pInfo.project_code,
                project_name: pInfo.project_name,
                branch_name: pInfo.branch_name,
                project_type: pInfo.project_type,
                year: year,
                monthNum: monthNum,
                count: 0,
                early: count
              };
            }
          }
        }
      }
    }

    const monthlyActualUsersRows = Object.values(consolidatedMonthly).map(item => [`;
code = code.replace(beforeConsolidateMap, consolidateEarlyLogic);

// 6. Map early_users column
code = code.replace(
  "      MONTH_NAMES_TH[item.monthNum] || 'ม.ค.',\n      item.count\n    ]);",
  "      MONTH_NAMES_TH[item.monthNum] || 'ม.ค.',\n      item.count,\n      item.early || 0\n    ]);"
);

// 7. Insert statement
code = code.replace(
  '          INSERT INTO monthly_actual_users \n            (project_code, project_name, branch_name, project_type, fiscal_year, month_number, month_name, actual_users)\n          VALUES ?',
  '          INSERT INTO monthly_actual_users \n            (project_code, project_name, branch_name, project_type, fiscal_year, month_number, month_name, actual_users, early_users)\n          VALUES ?'
);

fs.writeFileSync('d:/Antigravity/Customer Project/backend/update_data.js', code);
console.log('Successfully patched update_data.js');
