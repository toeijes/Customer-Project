const fs = require('fs');
const readline = require('readline');

async function countLines() {
  const fileStream = fs.createReadStream('d:/Antigravity/Customer Project/proj_cus.sql');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    if (line.trim().startsWith('(')) {
      count++;
    }
  }

  console.log(`Total rows in file: ${count}`);
}

countLines();
