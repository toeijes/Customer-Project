const http = require('http');

http.get('http://localhost:5000/api/projects', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    const sum = projects.reduce((acc, p) => acc + (p.total_actual_users || 0), 0);
    console.log("Sum from /api/projects:", sum);
  });
});
