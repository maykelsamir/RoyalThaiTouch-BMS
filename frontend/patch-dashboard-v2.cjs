const fs=require('fs');
const p='src/main.jsx';
let s=fs.readFileSync(p,'utf8');

s=s.replace(
"const todayISO=()=>new Date().toISOString().slice(0,10);",
"const todayISO=()=>new Date().toISOString().slice(0,10);const yesterdayISO=()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)};"
);

s=s.replace(
"const[businessDate,setBusinessDate]=useState(todayISO());const[dashboard,setDashboard]=useState(null);const[trend,setTrend]=useState([]);",
"const[businessDate,setBusinessDate]=useState(todayISO());const[dashboard,setDashboard]=useState(null);const[yesterdayDashboard,setYesterdayDashboard]=useState(null);const[trend,setTrend]=useState([]);"
);

s=s.replace(
"const visibleBranches=branches.filter(b=>allowed(b.id));const visibleIds=new Set(visibleBranches.map(b=>String(b.id)));const visibleRows=(dashboard?.branches||[]).filter(r=>allowed(r.branch_id));",
"const visibleBranches=branches.filter(b=>allowed(b.id));const visibleIds=new Set(visibleBranches.map(b=>String(b.id)));const visibleRows=(dashboard?.branches||[]).filter(r=>allowed(r.branch_id));const visibleYesterdayRows=(yesterdayDashboard?.branches||[]).filter(r=>allowed(r.branch_id));"
);

s=s.replace(
"async function loadData(dateValue=businessDate){const[d,b,t,us,emps,social,pending,fixed]=await Promise.all([api(`/dashboard?business_date=${dateValue}`),api('/branches'),api('/dashboard/trend?days=30'),api('/users'),api('/employees'),api('/social-links'),api('/pending-daily-entries'),api(`/monthly-fixed-expenses?month=${fixedMonth}`)]);setDashboard(d);",
"async function loadData(dateValue=businessDate){const[d,yd,b,t,us,emps,social,pending,fixed]=await Promise.all([api(`/dashboard?business_date=${dateValue}`),api(`/dashboard?business_date=${yesterdayISO()}`),api('/branches'),api('/dashboard/trend?days=30'),api('/users'),api('/employees'),api('/social-links'),api('/pending-daily-entries'),api(`/monthly-fixed-expenses?month=${fixedMonth}`)]);setDashboard(d);setYesterdayDashboard(yd);"
);

const oldBlock=`{page==='dashboard'&&<><section className="cards"><div className="metric"><span>Revenue Today</span><strong>{fmt(visibleRows.reduce((s,r)=>s+r.revenue,0))}</strong></div><div className="metric danger"><span>Expenses Today</span><strong>{fmt(visibleRows.reduce((s,r)=>s+r.expenses,0))}</strong></div><div className="metric gold"><span>Net Profit</span><strong>{fmt(visibleRows.reduce((s,r)=>s+r.net_profit,0))}</strong></div><div className="metric"><span>Pending Approval</span><strong>{visiblePending.length}</strong></div></section><section className="panel"><h3>30-Day Trend</h3><Chart data={trend}/></section><section className="panel"><h3>Branch Performance</h3><table><thead><tr><th>Branch</th><th>Revenue</th><th>Expenses</th><th>Profit</th><th>Status</th></tr></thead><tbody>{visibleRows.map(r=><tr key={r.branch_id}><td>{r.branch}</td><td>{fmt(r.revenue)}</td><td>{fmt(r.expenses)}</td><td>{fmt(r.net_profit)}</td><td>{r.status}</td></tr>)}</tbody></table></section></>}`;

const newBlock=`{page==='dashboard'&&<><section className="panel"><h3>Yesterday Overview</h3><p style={{color:'#a1a1aa',marginTop:0}}>{yesterdayISO()}</p></section><section className="cards">{visibleYesterdayRows.map(r=><div className="metric branchKpiCard" key={r.branch_id}><span className="branchKpiTitle">{r.branch}</span><div className="summaryLine"><span>Revenue</span><strong>{fmt(r.revenue)}</strong></div><div className="summaryLine"><span>Expenses</span><strong>{fmt(r.expenses)}</strong></div><div className="summaryLine total"><span>Net Profit</span><strong>{fmt(r.net_profit)}</strong></div></div>)}<div className="metric gold companyTotalCard"><span>Total Company Net Profit</span><strong>{fmt(visibleYesterdayRows.reduce((sum,r)=>sum+Number(r.net_profit||0),0))}</strong></div></section><section className="panel"><h3>30-Day Trend</h3><Chart data={trend}/></section></>}`;

if(!s.includes(oldBlock)){console.error('dashboard block not found');process.exit(1)}
s=s.replace(oldBlock,newBlock);
fs.writeFileSync(p,s);
