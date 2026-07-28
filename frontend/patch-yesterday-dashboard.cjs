const fs = require('fs');
const path = 'src/main.jsx';
let s = fs.readFileSync(path, 'utf8');

const helperOld = "const todayISO=()=>new Date().toISOString().slice(0,10);";
const helperNew = "const todayISO=()=>new Date().toISOString().slice(0,10);const yesterdayISO=()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)};";
s = s.replace(helperOld, helperNew);

const oldDashboard = `{page==='dashboard'&&<><section className="cards"><div className="metric"><span>Revenue Today</span><strong>{fmt(visibleRows.reduce((s,r)=>s+r.revenue,0))}</strong></div><div className="metric danger"><span>Expenses Today</span><strong>{fmt(visibleRows.reduce((s,r)=>s+r.expenses,0))}</strong></div><div className="metric gold"><span>Net Profit</span><strong>{fmt(visibleRows.reduce((s,r)=>s+r.net_profit,0))}</strong></div><div className="metric"><span>Pending Approval</span><strong>{visiblePending.length}</strong></div></section><section className="panel"><h3>30-Day Trend</h3><Chart data={trend}/></section><section className="panel"><h3>Branch Performance</h3><table><thead><tr><th>Branch</th><th>Revenue</th><th>Expenses</th><th>Profit</th><th>Status</th></tr></thead><tbody>{visibleRows.map(r=><tr key={r.branch_id}><td>{r.branch}</td><td>{fmt(r.revenue)}</td><td>{fmt(r.expenses)}</td><td>{fmt(r.net_profit)}</td><td>{r.status}</td></tr>)}</tbody></table></section></>}`;
const newDashboard = `{page==='dashboard'&&<><section className="panel"><h3>Yesterday Dashboard - {yesterdayISO()}</h3><p style={{color:'#a1a1aa',marginTop:0}}>Revenue, expenses, and net profit for each center from yesterday.</p></section><section className="cards">{visibleRows.map(r=><div className="metric" key={r.branch_id}><span>{r.branch}</span><div className="summaryLine"><span>Revenue</span><strong>{fmt(r.revenue)}</strong></div><div className="summaryLine"><span>Expenses</span><strong>{fmt(r.expenses)}</strong></div><div className="summaryLine total"><span>Net Profit</span><strong>{fmt(r.net_profit)}</strong></div></div>)}<div className="metric gold"><span>Total Company Net Profit Yesterday</span><strong>{fmt(visibleRows.reduce((s,r)=>s+Number(r.net_profit||0),0))}</strong></div></section><section className="panel"><h3>30-Day Trend</h3><Chart data={trend}/></section></>}`;
if (!s.includes(oldDashboard)) {
  console.error('dashboard block not found');
  process.exit(1);
}
s = s.replace(oldDashboard, newDashboard);

const oldLoad = "loadData().catch(()=>setMessage('Backend is starting. Please wait 30 seconds then refresh.'))";
const newLoad = "loadData(page==='dashboard'?yesterdayISO():businessDate).catch(()=>setMessage('Backend is starting. Please wait 30 seconds then refresh.'))";
s = s.replace(oldLoad, newLoad);

const oldDashNav = "{nav('dashboard',<BarChart3 size={18}/>, 'Dashboard')}";
const newDashNav = "{nav('dashboard',<BarChart3 size={18}/>, 'Dashboard',()=>{setPage('dashboard');setTimeout(()=>loadData(yesterdayISO()),100)})}";
s = s.replace(oldDashNav, newDashNav);

fs.writeFileSync(path, s);
