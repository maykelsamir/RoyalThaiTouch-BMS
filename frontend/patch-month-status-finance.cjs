const fs=require('fs');
const p='src/main.jsx';
let s=fs.readFileSync(p,'utf8');

const nav=`<nav className="groupedNav"><div className="navGroup"><div className="navSectionLabel">Main</div>{nav('dashboard',<BarChart3 size={18}/>, 'Dashboard')}</div><div className="navGroup"><div className="navSectionLabel">Operations</div>{nav('entry',<Save size={18}/>, 'Daily Entry')}{hasPerm('view_calendar')&&nav('calendar',<CalendarDays size={18}/>, 'Calendar',()=>{setPage('calendar');setTimeout(()=>loadMonthStatus(monthStatusMonth),100)},true)}</div><div className="navGroup"><div className="navSectionLabel">Finance</div>{nav('fixedExpenses',<Settings size={18}/>, 'Monthly Fixed Expenses',()=>setPage('fixedExpenses'),hasPerm('manage_expenses'))}{hasPerm('view_month_status')&&nav('monthStatus',<CalendarDays size={18}/>, 'month intery stauts',()=>{setPage('monthStatus');setTimeout(()=>loadMonthStatus(monthStatusMonth),100)},true)}{nav('reports',<Download size={18}/>, 'Reports',()=>{setPage('reports');setTimeout(loadReport,100)})}</div><div className="navGroup"><div className="navSectionLabel">HR</div>{nav('employees',<Users size={18}/>, 'Employees')}</div><div className="navGroup"><div className="navSectionLabel">Administration</div>{nav('branches',<Building2 size={18}/>, 'Branches')}{nav('users',<UserCog size={18}/>, 'Users')}{nav('audit',<ListChecks size={18}/>, 'Audit Log',()=>{setPage('audit');setTimeout(loadAuditLogs,100)})}</div><div className="navGroup"><div className="navSectionLabel">Marketing</div>{nav('social',<Link2 size={18}/>, 'Social Links',()=>{setPage('social');if(visibleBranches[0])changeSocialBranch(String(visibleBranches[0].id))})}</div><button className="logoutBtn" onClick={()=>setCurrent(null)}><LogOut size={18}/> Logout</button></nav></aside>`;

const navRegex=/<nav className="groupedNav">[\s\S]*?<\/nav><\/aside>/;
if(!navRegex.test(s)){console.error('grouped nav not found');process.exit(1)}
s=s.replace(navRegex,nav);

s=s.replace('<h3>month intery stauts</h3><p style={{color:\'#a1a1aa\',marginTop:0}}>Green means daily revenue is greater than zero. Red means revenue is zero or empty.</p>','<h3>month intery stauts</h3><p style={{color:\'#a1a1aa\',marginTop:0}}>Daily status from the first day to the last day of the selected month. Green means revenue is greater than zero; red means zero or empty.</p>');

fs.writeFileSync(p,s);
