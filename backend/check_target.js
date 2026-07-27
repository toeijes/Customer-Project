const http = require('http');

http.get('http://localhost:5000/api/projects', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    const sumActual = projects.reduce((acc, p) => acc + (p.total_actual_users || 0), 0);
    const sumTarget = projects.reduce((acc, p) => acc + (parseInt(p.target_users) || 0), 0);
    console.log("Sum Actual:", sumActual);
    console.log("Sum Target:", sumTarget);
    console.log("Achievement Rate:", (sumActual / sumTarget * 100).toFixed(1) + "%");
  });
});
