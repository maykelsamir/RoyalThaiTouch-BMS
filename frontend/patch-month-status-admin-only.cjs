const fs = require('fs');
const path = 'src/main.jsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  "{nav('monthStatus',<CalendarDays size={18}/>, 'month intery stauts',()=>{setPage('monthStatus');setTimeout(()=>loadMonthStatus(monthStatusMonth),100)},true)}",
  "{isManager()&&nav('monthStatus',<CalendarDays size={18}/>, 'month intery stauts',()=>{setPage('monthStatus');setTimeout(()=>loadMonthStatus(monthStatusMonth),100)},true)}"
);

s = s.replace(
  "const can=p=>current?.role==='Admin'||p==='monthStatus'||current?.permissions?.includes(p);",
  "const can=p=>current?.role==='Admin'||current?.permissions?.includes(p);"
);

s = s.replace(
  "if(current)loadData().catch(()=>setMessage('Backend is starting. Please wait 30 seconds then refresh.'))},[current]);useEffect(()=>{if(!current)return;if(page==='fixedExpenses'&&!isManager())setPage('dashboard');else if(page!=='fixedExpenses'&&!can(page))setPage(current.permissions?.[0]||'dashboard')},[current,page]);",
  "if(current)loadData().catch(()=>setMessage('Backend is starting. Please wait 30 seconds then refresh.'))},[current]);useEffect(()=>{if(!current)return;if((page==='fixedExpenses'||page==='monthStatus')&&!isManager())setPage('entry');else if(page!=='fixedExpenses'&&page!=='monthStatus'&&!can(page))setPage(current.permissions?.[0]||'entry')},[current,page]);"
);

s = s.replace(
  "{page==='monthStatus'&&<>",
  "{page==='monthStatus'&&isManager()&&<>"
);

fs.writeFileSync(path, s);
