const fs = require('fs');
const path = require('path');

function run() {
  const localPath = path.join(__dirname, 'actuals_summary.json');
  const serverPath = path.join(__dirname, 'actuals_summary_server.json');

  if (!fs.existsSync(localPath)) {
    console.error('Error: local actuals_summary.json not found! Run node compare_actuals.js locally first.');
    process.exit(1);
  }

  if (!fs.existsSync(serverPath)) {
    console.error('Error: actuals_summary_server.json not found!');
    console.log('\nInstructions:');
    console.log('1. Run "node compare_actuals.js" on your SERVER.');
    console.log('2. Copy the generated "actuals_summary.json" from the server.');
    console.log('3. Save it as "actuals_summary_server.json" in the backend/ directory of your LOCAL machine.');
    console.log('4. Run "node compare_summaries.js" on your LOCAL machine.');
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  const serverData = JSON.parse(fs.readFileSync(serverPath, 'utf8'));

  const localMap = new Map(localData.map(p => [p.project_code, p]));
  const serverMap = new Map(serverData.map(p => [p.project_code, p]));

  console.log('--- COMPARING LOCAL VS SERVER ---');
  console.log(`Local total projects: ${localData.length}`);
  console.log(`Server total projects: ${serverData.length}`);

  let diffCount = 0;
  let localTotalUsers = 0;
  let serverTotalUsers = 0;

  const allProjectCodes = new Set([...localMap.keys(), ...serverMap.keys()]);
  const sortedCodes = Array.from(allProjectCodes).sort();

  const mismatches = [];

  for (const code of sortedCodes) {
    const localProj = localMap.get(code);
    const serverProj = serverMap.get(code);

    const localUsers = localProj ? localProj.actual_users : 0;
    const serverUsers = serverProj ? serverProj.actual_users : 0;

    localTotalUsers += localUsers;
    serverTotalUsers += serverUsers;

    if (localUsers !== serverUsers) {
      diffCount++;
      mismatches.push({
        project_code: code,
        contract_no_local: localProj ? localProj.contract_no : 'N/A',
        contract_no_server: serverProj ? serverProj.contract_no : 'N/A',
        project_name: (localProj || serverProj).project_name,
        local_users: localUsers,
        server_users: serverUsers,
        difference: localUsers - serverUsers
      });
    }
  }

  console.log(`Local total users: ${localTotalUsers}`);
  console.log(`Server total users: ${serverTotalUsers}`);
  console.log(`Mismatched projects count: ${diffCount}\n`);

  if (mismatches.length > 0) {
    console.log('--- MISMATCHED PROJECTS DETAIL ---');
    mismatches.forEach(m => {
      console.log(`Project: ${m.project_code}`);
      console.log(`  Name: ${m.project_name}`);
      console.log(`  Contract No (Local) : ${m.contract_no_local}`);
      console.log(`  Contract No (Server): ${m.contract_no_server}`);
      console.log(`  Local Users : ${m.local_users}`);
      console.log(`  Server Users: ${m.server_users}`);
      console.log(`  Difference  : ${m.difference > 0 ? '+' : ''}${m.difference}`);
      console.log('--------------------------------------------------');
    });
  } else {
    console.log('✓ All project user counts match perfectly!');
  }
}

run();
