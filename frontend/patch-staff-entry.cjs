const fs = require('fs');
const path = 'src/main.jsx';
let s = fs.readFileSync(path, 'utf8');

const oldNotice = `<div className="notice" style={{marginTop:16}}>The expenses field was removed from Daily Entry. The monthly fixed expense is deducted automatically after saving/approval.</div>`;
const newNotice = `{isManager()&&<div className="notice" style={{marginTop:16}}>The expenses field was removed from Daily Entry. The monthly fixed expense is deducted automatically after saving/approval.</div>}`;
s = s.replace(oldNotice, newNotice);

const oldSummary = `<div className="panel summaryPanel"><h3>Daily Summary</h3><div className="summaryLine"><span>Revenue</span><strong>{fmt(entry.revenue)}</strong></div><div className="summaryLine"><span>Fixed Expense</span><strong>{fmt(fixedDaily)}</strong></div><div className="summaryLine total"><span>Net Profit</span><strong>{fmt(entryProfit)}</strong></div></div>`;
const newSummary = `{isManager()&&<div className="panel summaryPanel"><h3>Daily Summary</h3><div className="summaryLine"><span>Revenue</span><strong>{fmt(entry.revenue)}</strong></div><div className="summaryLine"><span>Fixed Expense</span><strong>{fmt(fixedDaily)}</strong></div><div className="summaryLine total"><span>Net Profit</span><strong>{fmt(entryProfit)}</strong></div></div>}`;
s = s.replace(oldSummary, newSummary);

fs.writeFileSync(path, s);
