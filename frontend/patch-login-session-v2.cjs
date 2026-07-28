const fs=require('fs');
const p='src/main.jsx';
let s=fs.readFileSync(p,'utf8');

const helpers=`
const readLoginSession=()=>{try{const a=localStorage.getItem('rtt_current_user');if(a)return JSON.parse(a)}catch{}try{const b=sessionStorage.getItem('rtt_current_user');if(b)return JSON.parse(b)}catch{}try{const m=document.cookie.match(/(?:^|; )rtt_current_user=([^;]*)/);if(m)return JSON.parse(decodeURIComponent(m[1]))}catch{}return null};
const saveLoginSession=user=>{if(!user)return;const raw=JSON.stringify(user);try{localStorage.setItem('rtt_current_user',raw)}catch{}try{sessionStorage.setItem('rtt_current_user',raw)}catch{}try{document.cookie='rtt_current_user='+encodeURIComponent(raw)+'; Path=/; Max-Age=2592000; SameSite=Lax; Secure'}catch{}};
const clearLoginSession=()=>{try{localStorage.removeItem('rtt_current_user')}catch{}try{sessionStorage.removeItem('rtt_current_user')}catch{}try{document.cookie='rtt_current_user=; Path=/; Max-Age=0; SameSite=Lax; Secure'}catch{}};
`;
if(!s.includes('const readLoginSession=')){
  const anchor="const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));";
  if(!s.includes(anchor)){console.error('storage helper anchor not found');process.exit(1)}
  s=s.replace(anchor,anchor+helpers);
}

s=s.replace(/const\[users,setUsers\]=useState\(\[\]\);const\[current,setCurrent\]=useState\(\(\)=>read\('rtt_current_user',null\)\);const\[page,setPage\]=useState\('dashboard'\);(?:const loginAndPersist=[\s\S]*?;const logoutAndClear=[\s\S]*?;)?/,
"const[users,setUsers]=useState([]);const[current,setCurrent]=useState(()=>readLoginSession());const[page,setPage]=useState('dashboard');const loginAndPersist=user=>{if(!user)return;saveLoginSession(user);setCurrent(user);setPage(user.role==='Staff'||user.role==='Reception'?'entry':'dashboard')};const logoutAndClear=()=>{clearLoginSession();setCurrent(null);setPage('dashboard')};");

s=s.replace(/useEffect\(\(\)=>\{if\(current\)write\('rtt_current_user',current\)\},\[current\]\);/g,"useEffect(()=>{if(current)saveLoginSession(current)},[current]);");
s=s.replace(/useEffect\(\(\)=>current\?write\('rtt_current_user',current\):localStorage\.removeItem\('rtt_current_user'\),\[current\]\);/g,"useEffect(()=>{if(current)saveLoginSession(current)},[current]);");
s=s.replace(/onLogin=\{setCurrent\}/g,'onLogin={loginAndPersist}');
s=s.replace(/onLogin=\{\(u\)=>setCurrent\(u\)\}/g,'onLogin={loginAndPersist}');
s=s.replace(/onClick=\{\(\)=>setCurrent\(null\)\}/g,'onClick={logoutAndClear}');

if(!s.includes('onLogin={loginAndPersist}')||!s.includes('readLoginSession()')){
  console.error('login session wiring not found');process.exit(1)
}
fs.writeFileSync(p,s);

const sw='public/sw.js';
if(fs.existsSync(sw)){
 let w=fs.readFileSync(sw,'utf8');
 w=w.replace(/const CACHE_NAME = '[^']+';/,"const CACHE_NAME = 'rtt-erp-v3-login-fix';");
 fs.writeFileSync(sw,w);
}
