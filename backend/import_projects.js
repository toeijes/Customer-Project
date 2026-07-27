const db = require('./db');
const fs = require('fs');
const path = require('path');

function splitSqlStatements(sqlText) {
  const statements = [];
  let currentStatement = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let escapeNext = false;
  
  // Strip comments first to avoid issues
  const lines = sqlText.split(/\r?\n/);
  const cleanLines = [];
  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.startsWith('/*')) {
      continue;
    }
    cleanLines.push(line);
  }
  const cleanSql = cleanLines.join('\n');

  for (let i = 0; i < cleanSql.length; i++) {
    const char = cleanSql[i];
    
    if (escapeNext) {
      currentStatement += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      currentStatement += char;
      escapeNext = true;
      continue;
    }
    
    if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
    }
    
    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    } else {
      currentStatement += char;
    }
  }
  if (currentStatement.trim().length > 0) {
    statements.push(currentStatement.trim());
  }
  return statements;
}

async function main() {
  try {
    console.log('Initializing database connection...');
    await db.initializeDatabase();
    
    console.log('Dropping existing projects table (safely with foreign key checks off)...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    await db.query('DROP TABLE IF EXISTS projects;');
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ Dropped projects table.');
    
    const sqlPath = path.join(__dirname, '../projects.sql');
    console.log(`Reading SQL file from ${sqlPath}...`);
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`File not found at ${sqlPath}`);
    }
    const sqlText = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Parsing SQL statements...');
    const statements = splitSqlStatements(sqlText);
    console.log(`Found ${statements.length} statements to execute.`);
    
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      
      if (stmt.startsWith('CREATE TABLE') || stmt.startsWith('INSERT') || stmt.startsWith('ALTER') || stmt.startsWith('COMMIT') || stmt.startsWith('START TRANSACTION')) {
        console.log(`Executing statement ${i + 1}/${statements.length}: ${stmt.substring(0, 60)}...`);
      }
      
      await db.query(stmt);
    }
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log('✓ Successfully imported projects table from SQL file.');
    
    const countRes = await db.query('SELECT COUNT(*) as count FROM projects;');
    console.log(`✓ Table 'projects' now has ${countRes[0].count} records.`);
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Import failed:', error);
    process.exit(1);
  }
}

main();
