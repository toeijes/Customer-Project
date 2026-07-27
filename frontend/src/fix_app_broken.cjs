const fs = require('fs');
const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Fix the broken parseBEParts and formatTh2En
const brokenStr = `    const m = parts[1].padStart(2, '0');
function MainApp({ user, onLogout }) {`;

const fixedStr = `    const m = parts[1].padStart(2, '0');
    const y = parseInt(parts[2], 10) - 543;
    return \`\${y}-\${m}-\${d}\`;
  }
  return val;
};

const parseBEParts = (dateStr) => {
  if (!dateStr) return { day: '', month: '', year: '' };
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return {
      day: parts[0],
      month: parts[1],
      year: parts[2]
    };
  }
  return { day: '', month: '', year: '' };
};

function MainApp({ user, onLogout }) {`;

code = code.replace(brokenStr, fixedStr);

// 2. Fix the TDZ error for filterZone
const brokenTdzStr = `  const isGlobalAndNoZone = (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all';
  const [filterYear, setFilterYear] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterType, setFilterType] = useState('all');`;

const fixedTdzStr = `  const [filterYear, setFilterYear] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const isGlobalAndNoZone = (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'planning') && filterZone === 'all';`;

code = code.replace(brokenTdzStr, fixedTdzStr);

fs.writeFileSync(path, code);
console.log('Fixed TDZ error and restored missing code');
