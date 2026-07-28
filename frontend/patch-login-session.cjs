const fs=require('fs');
const p='src/main.jsx';
let s=fs.readFileSync(p,'utf8');

// Replace the automatic session effect so a temporary null state does not erase a valid login.
s=s.replace(
  /useEffect\(\(\)=>current\?write\('rtt_current_user',current\):localStorage\.removeItem\('rtt_current_user'\),\[current\]\);/g,
  "useEffect(()=>{if(current)write('rtt_current_user',current)},[current]);"
);

// Add explicit login/logout helpers that persist synchronously.
const stateAnchor="const[users,setUsers]=useState([]);const[current,setCurrent]=useState(()=>read('rtt_current_user',null));const[page,setPage]=useState('dashboard');";
const stateReplacement=stateAnchor+"const loginAndPersist=user=>{if(!user)return;write('rtt_current_user',user);setCurrent(user);setPage(user.role==='Staff'||user.role==='Reception'?'entry':'dashboard')};const logoutAndClear=()=>{localStorage.removeItem('rtt_current_user');setCurrent(null);setPage('dashboard')};";
if(s.includes(stateAnchor)&&!s.includes('const loginAndPersist='))s=s.replace(stateAnchor,stateReplacement);

// Route both password and passkey logins through the persistent handler.
s=s.replace(/onLogin=\{setCurrent\}/g,'onLogin={loginAndPersist}');
s=s.replace(/onLogin=\{\(u\)=>setCurrent\(u\)\}/g,'onLogin={loginAndPersist}');

// Only explicit Logout may clear the saved session.
s=s.replace(/onClick=\{\(\)=>setCurrent\(null\)\}/g,'onClick={logoutAndClear}');

if(!s.includes('loginAndPersist')||!s.includes('logoutAndClear')){
  console.error('Login session anchors were not found');
  process.exit(1);
}

fs.writeFileSync(p,s);
