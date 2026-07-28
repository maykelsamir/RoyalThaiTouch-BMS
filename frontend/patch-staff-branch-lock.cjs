const fs = require('fs');
const path = 'src/main.jsx';
let s = fs.readFileSync(path, 'utf8');
const old = `<select value={entry.branch_id} onChange={async e=>{setEntry({...entry,branch_id:e.target.value});await loadEntry(e.target.value,entry.business_date)}}>{visibleBranches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>`;
const neu = `<select disabled={!isManager()} value={entry.branch_id} onChange={async e=>{if(!isManager())return;setEntry({...entry,branch_id:e.target.value});await loadEntry(e.target.value,entry.business_date)}}>{visibleBranches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>`;
if (!s.includes(old)) {
  console.error('Daily entry center select pattern not found');
  process.exit(1);
}
fs.writeFileSync(path, s.replace(old, neu));
