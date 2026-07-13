const fs = require('fs');
const mainPath = 'src/main.jsx';
let s = fs.readFileSync(mainPath, 'utf8');

s = s.replace(
  "const pageLabels={dashboard:'Dashboard',entry:'Daily Entry',fixedExpenses:'Monthly Fixed Expenses',monthStatus:'month intery stauts',reports:'Reports',branches:'Branches',employees:'Employees',social:'Social Links',audit:'Audit Log',users:'Users',settings:'Settings'};",
  "const pageLabels={dashboard:'Dashboard',entry:'Daily Entry',calendar:'Calendar',fixedExpenses:'Monthly Fixed Expenses',monthStatus:'month intery stauts',reports:'Reports',branches:'Branches',employees:'Employees',social:'Social Links',audit:'Audit Log',users:'Users',settings:'Settings'};"
);

s = s.replace(
  "const[monthStatusMonth,setMonthStatusMonth]=useState(monthISO());const[monthStatusRows,setMonthStatusRows]=useState([]);const[monthStatusLoading,setMonthStatusLoading]=useState(false);",
  "const[monthStatusMonth,setMonthStatusMonth]=useState(monthISO());const[monthStatusRows,setMonthStatusRows]=useState([]);const[monthStatusLoading,setMonthStatusLoading]=useState(false);const[calendarMonth,setCalendarMonth]=useState(monthISO());const[calendarRows,setCalendarRows]=useState([]);const[calendarLoading,setCalendarLoading]=useState(false);"
);

const loadMonthNeedle = "async function loadMonthStatus(m=monthStatusMonth){setMonthStatusLoading(true);try{const[y,mo]=m.split('-').map(Number);const last=new Date(y,mo,0).getDate();const rows=[];for(let day=1;day<=last;day++){const date=`${m}-${String(day).padStart(2,'0')}`;const centers=await Promise.all(visibleBranches.map(async b=>{try{const d=await api(`/daily-entry?branch_id=${b.id}&business_date=${date}`);return{id:b.id,name:b.name,revenue:Number(d.revenue||0)}}catch{return{id:b.id,name:b.name,revenue:0}}}));rows.push({date,centers})}setMonthStatusRows(rows);setMessage('Month entry status loaded')}finally{setMonthStatusLoading(false)}}";
const loadCalendarFn = `${loadMonthNeedle}async function loadCalendar(m=calendarMonth){setCalendarLoading(true);try{const pending=await api('/pending-daily-entries').catch(()=>[]);const[y,mo]=m.split('-').map(Number);const last=new Date(y,mo,0).getDate();const firstWeekday=new Date(y,mo-1,1).getDay();const rows=[];for(let day=1;day<=last;day++){const date=\`${'${m}'}-${'${String(day).padStart(2,\'0\')}' }\`;const isFuture=date>todayISO();const centers=await Promise.all(visibleBranches.map(async b=>{const p=(pending||[]).find(x=>String(x.branch_id)===String(b.id)&&x.business_date===date);if(isFuture)return{id:b.id,name:b.name,status:'future',revenue:0};try{const d=await api(\`/daily-entry?branch_id=${'${b.id}'}&business_date=${'${date}'}\`);const revenue=Number(d.revenue||0);if(d.closed)return{id:b.id,name:b.name,status:'closed',revenue};if(revenue>0)return{id:b.id,name:b.name,status:'submitted',revenue};if(p)return{id:b.id,name:b.name,status:'pending',revenue:Number(p.revenue||0)};return{id:b.id,name:b.name,status:'missing',revenue:0}}catch{return{id:b.id,name:b.name,status:p?'pending':'missing',revenue:Number(p?.revenue||0)}}}));rows.push({day,date,centers})}setCalendarRows(rows);setMessage('Calendar loaded');return firstWeekday}finally{setCalendarLoading(false)}}`;
if (!s.includes(loadMonthNeedle)) {
  console.error('loadMonthStatus function not found');
  process.exit(1);
}
s = s.replace(loadMonthNeedle, loadCalendarFn);

s = s.replace(
  "if((page==='fixedExpenses'||page==='monthStatus')&&!isManager())setPage('entry');",
  "if((page==='fixedExpenses'||page==='monthStatus'||page==='calendar')&&!isManager())setPage('entry');"
);

s = s.replace(
  "<div className=\"navGroup\"><div className=\"navSectionLabel\">Operations</div>{nav('entry',<Save size={18}/>, 'Daily Entry')}{isManager()&&nav('monthStatus',<CalendarDays size={18}/>, 'month intery stauts',()=>{setPage('monthStatus');setTimeout(()=>loadMonthStatus(monthStatusMonth),100)},true)}</div>",
  "<div className=\"navGroup\"><div className=\"navSectionLabel\">Operations</div>{nav('entry',<Save size={18}/>, 'Daily Entry')}{isManager()&&nav('calendar',<CalendarDays size={18}/>, 'Calendar',()=>{setPage('calendar');setTimeout(()=>loadCalendar(calendarMonth),100)},true)}{isManager()&&nav('monthStatus',<CalendarDays size={18}/>, 'month intery stauts',()=>{setPage('monthStatus');setTimeout(()=>loadMonthStatus(monthStatusMonth),100)},true)}</div>"
);

const calendarPage = `{page==='calendar'&&isManager()&&<><section className="panel"><div className="splitPanel"><div><h3>Monthly Entry Calendar</h3><p style={{color:'#a1a1aa',marginTop:0}}>Daily status for every center.</p></div><div className="buttonGroup"><input type="month" value={calendarMonth} onChange={e=>setCalendarMonth(e.target.value)} style={{width:180}}/><button onClick={()=>loadCalendar(calendarMonth)}><RefreshCcw size={16}/> {calendarLoading?'Loading...':'Load Calendar'}</button></div></div><div className="calendarLegend"><span className="calSubmitted">Submitted</span><span className="calPending">Pending</span><span className="calMissing">Missing</span><span className="calClosed">Closed</span><span className="calFuture">Future</span></div></section><section className="calendarGrid">{Array.from({length:new Date(Number(calendarMonth.slice(0,4)),Number(calendarMonth.slice(5,7))-1,1).getDay()}).map((_,i)=><div className="calendarBlank" key={'blank'+i}></div>)}{calendarRows.map(row=><article className="calendarDay" key={row.date}><div className="calendarDate"><b>{row.day}</b><span>{row.date}</span></div><div className="calendarCenters">{row.centers.map(c=><div key={c.id} className={'calendarCenter cal-'+c.status}><span>{c.name}</span><small>{c.status==='submitted'||c.status==='closed'?fmt(c.revenue):c.status}</small></div>)}</div></article>)}</section>{!calendarRows.length&&<section className="panel"><p style={{color:'#a1a1aa'}}>Choose a month and press Load Calendar.</p></section>}</>}`;
const insertBefore = "{page==='reports'&&<>";
if (!s.includes(insertBefore)) {
  console.error('reports page insertion point not found');
  process.exit(1);
}
s = s.replace(insertBefore, calendarPage + insertBefore);

fs.writeFileSync(mainPath, s);

const cssPath = 'src/style.css';
let css = fs.readFileSync(cssPath, 'utf8');
const styles = `

/* Monthly status calendar */
.calendarLegend { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.calendarLegend span { padding:7px 11px; border-radius:999px; font-size:12px; font-weight:800; }
.calSubmitted, .cal-submitted { background:rgba(83,215,105,.14); color:#75f09a; border:1px solid rgba(83,215,105,.34); }
.calPending, .cal-pending { background:rgba(255,193,7,.14); color:#ffd166; border:1px solid rgba(255,193,7,.34); }
.calMissing, .cal-missing { background:rgba(255,107,107,.14); color:#ff9a9a; border:1px solid rgba(255,107,107,.34); }
.calClosed, .cal-closed { background:rgba(212,175,55,.14); color:#f7df8e; border:1px solid rgba(212,175,55,.34); }
.calFuture, .cal-future { background:rgba(161,161,170,.10); color:#a1a1aa; border:1px solid rgba(161,161,170,.20); }
.calendarGrid { display:grid; grid-template-columns:repeat(7,minmax(180px,1fr)); gap:12px; overflow-x:auto; padding-bottom:10px; }
.calendarBlank { min-height:40px; }
.calendarDay { background:rgba(17,19,26,.94); border:1px solid rgba(255,255,255,.08); border-radius:18px; padding:13px; min-height:180px; }
.calendarDate { display:flex; justify-content:space-between; align-items:center; margin-bottom:11px; color:#d4af37; }
.calendarDate b { font-size:22px; }
.calendarDate span { color:#71717a; font-size:11px; }
.calendarCenters { display:grid; gap:7px; }
.calendarCenter { display:flex; justify-content:space-between; gap:8px; align-items:center; border-radius:10px; padding:8px 9px; }
.calendarCenter span { font-size:12px; font-weight:800; }
.calendarCenter small { font-size:10px; text-transform:capitalize; white-space:nowrap; }
@media (max-width:768px) {
  .calendarGrid { grid-template-columns:1fr !important; overflow:visible !important; }
  .calendarBlank { display:none; }
  .calendarDay { min-height:auto; }
}
`;
if (!css.includes('/* Monthly status calendar */')) css += styles;
fs.writeFileSync(cssPath, css);
