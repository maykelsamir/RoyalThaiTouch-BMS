const fs = require('fs');
const mainPath = 'src/main.jsx';
let s = fs.readFileSync(mainPath, 'utf8');

const groupedNav = `<nav className="groupedNav"><div className="navGroup"><div className="navSectionLabel">Main</div>{nav('dashboard',<BarChart3 size={18}/>, 'Dashboard')}</div><div className="navGroup"><div className="navSectionLabel">Operations</div>{nav('entry',<Save size={18}/>, 'Daily Entry')}{isManager()&&nav('monthStatus',<CalendarDays size={18}/>, 'month intery stauts',()=>{setPage('monthStatus');setTimeout(()=>loadMonthStatus(monthStatusMonth),100)},true)}</div><div className="navGroup"><div className="navSectionLabel">Finance</div>{nav('fixedExpenses',<Settings size={18}/>, 'Monthly Fixed Expenses',()=>setPage('fixedExpenses'),isManager())}{nav('reports',<Download size={18}/>, 'Reports',()=>{setPage('reports');setTimeout(loadReport,100)})}</div><div className="navGroup"><div className="navSectionLabel">HR</div>{nav('employees',<Users size={18}/>, 'Employees')}</div><div className="navGroup"><div className="navSectionLabel">Administration</div>{nav('branches',<Building2 size={18}/>, 'Branches')}{nav('users',<UserCog size={18}/>, 'Users')}{nav('audit',<ListChecks size={18}/>, 'Audit Log',()=>{setPage('audit');setTimeout(loadAuditLogs,100)})}</div><div className="navGroup"><div className="navSectionLabel">Marketing</div>{nav('social',<Link2 size={18}/>, 'Social Links',()=>{setPage('social');if(visibleBranches[0])changeSocialBranch(String(visibleBranches[0].id))})}</div><button className="logoutBtn" onClick={()=>setCurrent(null)}><LogOut size={18}/> Logout</button></nav></aside>`;

const navRegex = /<nav(?: className="groupedNav")?>[\s\S]*?<\/nav><\/aside>/;
if (!navRegex.test(s)) {
  console.error('Sidebar navigation block not found');
  process.exit(1);
}
s = s.replace(navRegex, groupedNav);
fs.writeFileSync(mainPath, s);

const cssPath = 'src/style.css';
let css = fs.readFileSync(cssPath, 'utf8');
const styles = `

/* Grouped sidebar navigation */
.groupedNav { display: flex; flex-direction: column; gap: 18px; }
.navGroup { display: grid; gap: 8px; }
.navSectionLabel { color: #71717a; font-size: 11px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; padding: 0 12px; }
.groupedNav .logoutBtn { margin-top: 8px; background: rgba(255,107,107,.10); color: #ff9a9a; border: 1px solid rgba(255,107,107,.20); }
.groupedNav .logoutBtn:hover { background: rgba(255,107,107,.18); color: #fff; border-color: rgba(255,107,107,.35); }
@media (max-width: 768px) {
  .groupedNav { display: flex !important; flex-direction: row !important; gap: 8px !important; overflow-x: auto !important; }
  .navGroup { display: contents !important; }
  .navSectionLabel { display: none !important; }
  .groupedNav .logoutBtn { margin-top: 0 !important; flex: 0 0 auto !important; }
}
`;
if (!css.includes('/* Grouped sidebar navigation */')) css += styles;
fs.writeFileSync(cssPath, css);
