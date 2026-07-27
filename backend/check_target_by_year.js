const http = require('http');

http.get('http://localhost:5000/api/projects', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    const summary = {};
    projects.forEach(p => {
      const year = p.completion_year;
      if (!summary[year]) summary[year] = { actual: 0, target: 0 };
      summary[year].actual += (p.total_actual_users || 0);
      summary[year].target += (parseInt(p.target_users) || 0);
    });
    
    console.log("Current by year:");
    for (let year in summary) {
        console.log(`Year ${year}: Actual ${summary[year].actual}, Target ${summary[year].target}, Achiev ${(summary[year].actual/summary[year].target*100).toFixed(1)}%`);
    }
  });
});
