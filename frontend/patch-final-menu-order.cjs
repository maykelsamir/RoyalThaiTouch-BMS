const fs = require('fs');
const path = 'src/main.jsx';
let s = fs.readFileSync(path, 'utf8');

const finalNav = `<nav>{nav('dashboard',<BarChart3 size={18}/>, 'Dashboard')}{nav('entry',<Save size={18}/>, 'Daily Entry')}{nav('reports',<Download size={18}/>, 'Reports',()=>{setPage('reports');setTimeout(loadReport,100)})}{nav('branches',<Building2 size={18}/>, 'Branches')}{nav('employees',<Users size={18}/>, 'Employees')}{nav('social',<Link2 size={18}/>, 'Social Links',()=>{setPage('social');if(visibleBranches[0])changeSocialBranch(String(visibleBranches[0].id))})}{nav('audit',<ListChecks size={18}/>, 'Audit Log',()=>{setPage('audit');setTimeout(loadAuditLogs,100)})}{nav('users',<UserCog size={18}/>, 'Users')}{nav('fixedExpenses',<Settings size={18}/>, 'Monthly Fixed Expenses',()=>setPage('fixedExpenses'),isManager())}{isManager()&&nav('monthStatus',<CalendarDays size={18}/>, 'month intery stauts',()=>{setPage('monthStatus');setTimeout(()=>loadMonthStatus(monthStatusMonth),100)},true)}<button className="logoutBtn" onClick={()=>setCurrent(null)}><LogOut size={18}/> Logout</button></nav></aside>`;

const regex = /<nav>[\s\S]*?<\/nav><\/aside>/;
if (!regex.test(s)) {
  console.error('nav block not found');
  process.exit(1);
}
s = s.replace(regex, finalNav);

fs.writeFileSync(path, s);
