const fs = require('fs');
const path = 'src/main.jsx';
let s = fs.readFileSync(path, 'utf8');

const anchor = "const allPages=Object.keys(pageLabels);";
const permissionCode = `const permissionDefinitions=[
  ['view_dashboard','View Dashboard'],
  ['enter_revenue','Enter Daily Revenue'],
  ['approve_revenue','Approve Daily Revenue'],
  ['view_month_status','View Month Entry Status'],
  ['view_calendar','View Operations Calendar'],
  ['view_reports','View Reports'],
  ['export_reports','Export Excel / PDF'],
  ['manage_expenses','Manage Monthly Expenses'],
  ['manage_employees','Manage Employees'],
  ['manage_branches','Manage Centers'],
  ['manage_users','Manage Users'],
  ['view_audit','View Audit Log'],
  ['manage_social','Manage Social Links']
];
const allPermissionKeys=permissionDefinitions.map(x=>x[0]);
const pagePermissionMap={dashboard:'view_dashboard',entry:'enter_revenue',monthStatus:'view_month_status',calendar:'view_calendar',reports:'view_reports',fixedExpenses:'manage_expenses',employees:'manage_employees',branches:'manage_branches',users:'manage_users',audit:'view_audit',social:'manage_social'};
const rolePermissionDefaults={Admin:allPermissionKeys,Manager:allPermissionKeys,Accountant:['view_dashboard','approve_revenue','view_month_status','view_calendar','view_reports','export_reports','manage_expenses'],Reception:['view_dashboard','enter_revenue'],Staff:['enter_revenue']};`;
if (!s.includes('const permissionDefinitions=')) s = s.replace(anchor, anchor + permissionCode);

s = s.replace(
  "const[userForm,setUserForm]=useState({username:'',secret:'',role:'Staff',permissions:['dashboard','entry'],allowedBranches:[],active:true});",
  "const[userForm,setUserForm]=useState({username:'',secret:'',role:'Staff',permissions:rolePermissionDefaults.Staff,allowedBranches:[],active:true});"
);

s = s.replace(
  /const can=p=>[^;]+;const isManager=\(\)=>[^;]+;/,
  "const hasPerm=p=>current?.role==='Admin'||current?.permissions?.includes(p);const can=p=>current?.role==='Admin'||hasPerm(pagePermissionMap[p])||current?.permissions?.includes(p);const isManager=()=>current?.role==='Admin'||current?.role==='Manager'||hasPerm('approve_revenue')||hasPerm('manage_users')||hasPerm('manage_expenses');"
);

s = s.replace(
  "setUserForm({username:'',secret:'',role:'Staff',permissions:['dashboard','entry'],allowedBranches:[],active:true});",
  "setUserForm({username:'',secret:'',role:'Staff',permissions:rolePermissionDefaults.Staff,allowedBranches:[],active:true});"
);

s = s.replace(
  "permissions:allPages,allowed_branches:[]",
  "permissions:allPermissionKeys,allowed_branches:[]"
);

s = s.replace(
  /<select value=\{userForm\.role\} onChange=\{e=>setUserForm\(\{\.\.\.userForm,role:e\.target\.value\}\)\}>/g,
  "<select value={userForm.role} onChange={e=>{const role=e.target.value;setUserForm({...userForm,role,permissions:rolePermissionDefaults[role]||[]})}}>"
);

s = s.replace(
  /<div className="panel"><h3>Page Permissions<\/h3><div className="buttonGroup">\{allPages\.map\(k=><button key=\{k\} className=\{userForm\.permissions\.includes\(k\)\?'':'secondaryBtn'\} style=\{\{width:'auto',margin:0\}\} onClick=\{\(\)=>togglePermission\(k\)\}>\{pageLabels\[k\]\}<\/button>\)\}<\/div><\/div>/,
  `<div className="panel"><div className="splitPanel"><div><h3>Detailed Permissions</h3><p style={{color:'#a1a1aa',marginTop:0}}>Choose exactly what this user can view or manage.</p></div><button type="button" className="secondaryBtn" onClick={()=>setUserForm(x=>({...x,permissions:allPermissionKeys}))}>Select All</button></div><div className="permissionGrid">{permissionDefinitions.map(([key,label])=><label className={userForm.permissions.includes(key)?'permissionCard selected':'permissionCard'} key={key}><input type="checkbox" checked={userForm.permissions.includes(key)} onChange={()=>togglePermission(key)}/><span>{label}</span></label>)}</div></div>`
);

s = s.replace(/if\(!isManager\(\)\)\{await api\('\/pending-daily-entries'/g, "if(!hasPerm('approve_revenue')){await api('/pending-daily-entries'");
s = s.replace("if(!isManager())return setMessage('Only manager can approve entries')", "if(!hasPerm('approve_revenue'))return setMessage('You do not have permission to approve entries')");
s = s.replace(/isManager\(\)\?'Daily Revenue Entry \/ Direct Approval':'Daily Revenue Entry - Pending Approval'/g, "hasPerm('approve_revenue')?'Daily Revenue Entry / Direct Approval':'Daily Revenue Entry - Pending Approval'");
s = s.replace(/isManager\(\)\?'Save Approved Day':'Submit for Approval'/g, "hasPerm('approve_revenue')?'Save Approved Day':'Submit for Approval'");
s = s.replace(/\{isManager\(\)&&<section className="panel"><h3>Pending Daily Revenue Approvals/g, "{hasPerm('approve_revenue')&&<section className=\"panel\"><h3>Pending Daily Revenue Approvals");

s = s.replace(/isManager\(\)&&nav\('monthStatus'/g, "hasPerm('view_month_status')&&nav('monthStatus'");
s = s.replace(/isManager\(\)&&nav\('calendar'/g, "hasPerm('view_calendar')&&nav('calendar'");
s = s.replace(/nav\('fixedExpenses',<Settings size=\{18\}\/>, 'Monthly Fixed Expenses',\(\)=>setPage\('fixedExpenses'\),isManager\(\)\)/g, "nav('fixedExpenses',<Settings size={18}/>, 'Monthly Fixed Expenses',()=>setPage('fixedExpenses'),hasPerm('manage_expenses'))");
s = s.replace(/page==='fixedExpenses'&&isManager\(\)/g, "page==='fixedExpenses'&&hasPerm('manage_expenses')");
s = s.replace(/page==='monthStatus'&&isManager\(\)/g, "page==='monthStatus'&&hasPerm('view_month_status')");
s = s.replace(/page==='calendar'&&isManager\(\)/g, "page==='calendar'&&hasPerm('view_calendar')");

s = s.replace(
  /<button onClick=\{\(\)=>window\.open\(`\$\{API\}\/reports\/excel\?\$\{reportQuery\(\)\}`,'_blank'\)\}><Download size=\{18\}\/?> Export Excel<\/button>/g,
  "{hasPerm('export_reports')&&<button onClick={()=>window.open(`${API}/reports/excel?${reportQuery()}`,'_blank')}><Download size={18}/> Export Excel</button>}"
);
s = s.replace(
  /<button onClick=\{\(\)=>window\.open\(`\$\{API\}\/reports\/pdf\?\$\{reportQuery\(\)\}`,'_blank'\)\}><FileText size=\{18\}\/?> Export PDF<\/button>/g,
  "{hasPerm('export_reports')&&<button onClick={()=>window.open(`${API}/reports/pdf?${reportQuery()}`,'_blank')}><FileText size={18}/> Export PDF</button>}"
);

fs.writeFileSync(path, s);

const cssPath='src/style.css';
let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('/* Granular permissions */')) css += `

/* Granular permissions */
.permissionGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.permissionCard{display:flex;align-items:center;gap:10px;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.025);cursor:pointer}.permissionCard.selected{border-color:rgba(212,175,55,.55);background:rgba(212,175,55,.10);color:#f5d76e}.permissionCard input{width:auto!important;margin:0}.permissionCard span{font-weight:700}@media(max-width:768px){.permissionGrid{grid-template-columns:1fr}}
`;
fs.writeFileSync(cssPath,css);
