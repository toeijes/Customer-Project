const http = require('http');

http.get('http://localhost:5000/api/projects', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    const summary = {};
    projects.forEach(p => {
      const type = p.project_type;
      if (!summary[type]) summary[type] = { actual: 0, target: 0 };
      summary[type].actual += (p.total_actual_users || 0);
      summary[type].target += (parseInt(p.target_users) || 0);
    });
    
    // Also try to find the old state before my update
    // The previous update_data.js might have updated something.
    console.log("Current by type:", summary);
    
    // Total for type 1+2
    const actual12 = summary[1].actual + summary[2].actual;
    const target12 = summary[1].target + summary[2].target;
    console.log("Type 1+2 Actual:", actual12, "Target:", target12, "Achiev:", (actual12/target12*100).toFixed(1));
  });
});
