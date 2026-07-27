const fs = require('fs');

const path = 'd:/Antigravity/Customer Project/frontend/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

const targetDropdown = `<option value="all">ทุกสาขา ในสังกัด เขต 6</option>
              {branches.map(b => <option key={b.id} value={b.branch_name}>กปภ.สาขา{b.branch_name}</option>)}`;

const replacementDropdown = `<option value="all">
                {(user?.role === 'admin' || user?.role === 'planning') 
                  ? (filterZone === 'all' ? 'ทุกสาขา' : \`ทุกสาขา ในสังกัด เขต \${filterZone}\`) 
                  : \`ทุกสาขา ในสังกัด เขต \${user?.area}\`}
              </option>
              {branches
                .filter(b => {
                  if (user?.role === 'admin' || user?.role === 'planning') {
                    return filterZone === 'all' || String(b.zone) === String(filterZone);
                  } else {
                    return String(b.zone) === String(user?.area);
                  }
                })
                .map(b => <option key={b.id} value={b.branch_name}>กปภ.สาขา{b.branch_name}</option>)}`;

if (code.includes('<option value="all">ทุกสาขา ในสังกัด เขต 6</option>')) {
  code = code.replace(targetDropdown, replacementDropdown);
  fs.writeFileSync(path, code);
  console.log("Patched Branch Dropdown to depend on filterZone");
} else {
  console.log("Could not find target dropdown code.");
}
