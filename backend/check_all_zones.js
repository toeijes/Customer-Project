const http = require('http');

http.get('http://localhost:5000/api/projects', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    
    http.get('http://localhost:5000/api/branches', (res2) => {
      let bdata = '';
      res2.on('data', (chunk) => bdata += chunk);
      res2.on('end', () => {
        const branches = JSON.parse(bdata);
        const branchToZone = {};
        branches.forEach(b => { branchToZone[b.pwa_code] = b.zone; });
        
        const zoneActuals = {};
        let unknownZone = 0;
        
        projects.forEach(p => {
          const zone = branchToZone[p.pwa_code];
          if (zone) {
              zoneActuals[zone] = (zoneActuals[zone] || 0) + (p.total_actual_users || 0);
          } else {
              unknownZone += (p.total_actual_users || 0);
              if (p.total_actual_users > 0) {
                  console.log("Project with unknown zone:", p.project_code, "branch:", p.pwa_code, "actuals:", p.total_actual_users);
              }
          }
        });
        
        console.log("Zone Actuals:", zoneActuals);
        console.log("Unknown Zone Actuals:", unknownZone);
      });
    });
  });
});
