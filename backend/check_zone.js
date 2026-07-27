const http = require('http');

http.get('http://localhost:5000/api/projects', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    let zone6Actual = 0;
    let zone7Actual = 0;
    
    // We need branches to map pwa_code to zone
    http.get('http://localhost:5000/api/branches', (res2) => {
      let bdata = '';
      res2.on('data', (chunk) => bdata += chunk);
      res2.on('end', () => {
        const branches = JSON.parse(bdata);
        const branchToZone = {};
        branches.forEach(b => { branchToZone[b.pwa_code] = b.zone; });
        
        projects.forEach(p => {
          const zone = branchToZone[p.pwa_code];
          if (zone == 6) zone6Actual += (p.total_actual_users || 0);
          if (zone == 7) zone7Actual += (p.total_actual_users || 0);
        });
        
        console.log("Zone 6 Actuals:", zone6Actual);
        console.log("Zone 7 Actuals:", zone7Actual);
      });
    });
  });
});
