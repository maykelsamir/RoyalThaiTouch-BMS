const fs=require('fs');
const p='src/main.jsx';
const cssPath='src/style.css';
let s=fs.readFileSync(p,'utf8');

// Session helpers: one clear source of truth.
const helperAnchor="const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));";
const helpers=`
const readAuthSession=()=>{try{return JSON.parse(localStorage.getItem('rtt_current_user')||'null')}catch{return null}};
const saveAuthSession=user=>{if(user)localStorage.setItem('rtt_current_user',JSON.stringify(user))};
const clearAuthSession=()=>localStorage.removeItem('rtt_current_user');
`;
if(!s.includes('const readAuthSession=')){
 if(!s.includes(helperAnchor)){console.error('auth helper anchor not found');process.exit(1)}
 s=s.replace(helperAnchor,helperAnchor+helpers);
}

// Replace the entire authentication component after every earlier feature patch.
const authRegex=/function AuthScreen\([\s\S]*?\n\nfunction App\(\)\{/;
const auth=`function AuthScreen({users,onLogin,onCreateFirstAdmin}){
 const setup=users.length===0;
 const[username,setUsername]=useState('');
 const[secret,setSecret]=useState('');
 const[error,setError]=useState('');
 const[busy,setBusy]=useState(false);
 function submit(e){
  e.preventDefault();setError('');
  if(setup){Promise.resolve(onCreateFirstAdmin(username,secret)).catch(err=>setError(err.message||'Could not create admin'));return}
  const u=users.find(x=>x.username===username&&x.secret===secret&&x.active!==false);
  if(!u){setError('Invalid username or password');return}
  onLogin(u);
 }
 async function biometric(){
  if(!username){setError('Enter username first');return}
  if(!window.PublicKeyCredential||typeof prepPublicKey!=='function'){setError('Face ID / fingerprint is not available on this device');return}
  setBusy(true);setError('');
  try{
   const r=await fetch(API+'/passkeys/auth/options?username='+encodeURIComponent(username));
   const o=await r.json();if(!r.ok)throw new Error(o.detail||'Passkey is not enabled');
   const cred=await navigator.credentials.get({publicKey:prepPublicKey(o)});
   const v=await fetch(API+'/passkeys/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,credential:credentialJSON(cred)})});
   const data=await v.json();if(!v.ok)throw new Error(data.detail||'Biometric login failed');
   onLogin(data.user);
  }catch(err){setError(err.message||'Biometric login cancelled')}finally{setBusy(false)}
 }
 return <div className="appShell authShell"><form className="panel authPanel" onSubmit={submit}>
  <div className="brand"><div className="brandLogo">RTT</div><div><h1>Royal Thai Touch</h1><span>{setup?'Create Admin User':'ERP Login'}</span></div></div>
  <h3><Lock size={18}/> {setup?'First Admin Setup':'Login'}</h3>
  {error&&<div className="notice">{error}</div>}
  <label>Username</label><input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" autoFocus/>
  <label>Password</label><input type="password" value={secret} onChange={e=>setSecret(e.target.value)} autoComplete="current-password"/>
  <button className="primaryBtn" disabled={busy}>{setup?'Create Admin':'Login'}</button>
  {!setup&&<button type="button" className="secondaryBtn biometricBtn" onClick={biometric} disabled={busy}>{busy?'Checking...':'Use Face ID / Fingerprint'}</button>}
 </form></div>
}

function App(){`;
if(!authRegex.test(s)){console.error('AuthScreen block not found');process.exit(1)}
s=s.replace(authRegex,auth);

// Stable session state and explicit handlers.
const stateRegex=/const\[users,setUsers\]=useState\(\[\]\);const\[current,setCurrent\]=useState\([^;]+;const\[page,setPage\]=useState\('dashboard'\);(?:const loginAndPersist=[\s\S]*?;const logoutAndClear=[\s\S]*?;)?/;
const state="const[users,setUsers]=useState([]);const[current,setCurrent]=useState(()=>readAuthSession());const[page,setPage]=useState('dashboard');const loginAndPersist=user=>{if(!user)return;saveAuthSession(user);setCurrent(user);setPage(['Staff','Reception'].includes(user.role)?'entry':'dashboard')};const logoutAndClear=()=>{clearAuthSession();setCurrent(null);setPage('dashboard')};";
if(!stateRegex.test(s)){console.error('App auth state not found');process.exit(1)}
s=s.replace(stateRegex,state);

// Never erase a valid session during initial rendering.
s=s.replace(/useEffect\(\(\)=>current\?write\('rtt_current_user',current\):localStorage\.removeItem\('rtt_current_user'\),\[current\]\);/g,"useEffect(()=>{if(current)saveAuthSession(current)},[current]);");
s=s.replace(/useEffect\(\(\)=>\{if\(current\)(?:write\('rtt_current_user',current\)|saveLoginSession\(current\))\},\[current\]\);/g,"useEffect(()=>{if(current)saveAuthSession(current)},[current]);");

// Route all authentication actions through the stable handlers.
s=s.replace(/onLogin=\{setCurrent\}/g,'onLogin={loginAndPersist}');
s=s.replace(/onLogin=\{\(u\)=>setCurrent\(u\)\}/g,'onLogin={loginAndPersist}');
s=s.replace(/onLogin=\{loginAndPersist\}/g,'onLogin={loginAndPersist}');
s=s.replace(/onClick=\{\(\)=>setCurrent\(null\)\}/g,'onClick={logoutAndClear}');

if(!s.includes('onLogin={loginAndPersist}')){console.error('AuthScreen render wiring not found');process.exit(1)}
fs.writeFileSync(p,s);

let css=fs.readFileSync(cssPath,'utf8');
const marker='/* Stable full-screen authentication */';
const styles=`
/* Stable full-screen authentication */
.authShell{width:100%;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:#042B34}
.authPanel{width:min(520px,94vw);box-sizing:border-box}
.biometricBtn{margin-top:10px!important;border-color:rgba(212,175,55,.35)!important;background:rgba(212,175,55,.08)!important;color:#f4d66f!important}
@media(max-width:768px){
 html,body,#root{width:100%;min-height:100%;margin:0;background:#042B34!important}
 body{overflow-x:hidden}
 .authShell{width:100vw!important;min-height:100vh!important;min-height:100dvh!important;padding:0!important;align-items:stretch!important;justify-content:flex-start!important}
 .authPanel{width:100vw!important;max-width:none!important;min-height:100vh!important;min-height:100dvh!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:max(34px,env(safe-area-inset-top)) 24px max(28px,env(safe-area-inset-bottom))!important;display:flex!important;flex-direction:column!important;justify-content:center!important;background:linear-gradient(180deg,#063945 0%,#042B34 100%)!important}
 .authPanel .brand{width:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;padding:0 0 24px!important;margin-bottom:20px!important}
 .authPanel .brandLogo{width:min(78vw,360px)!important;height:auto!important;min-height:180px!important;margin:0 auto 18px!important;background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important}
 .authPanel h1{font-size:clamp(30px,8vw,42px)!important}
 .authPanel h3{font-size:22px!important;margin:0 0 18px!important}
 .authPanel label{font-size:17px!important;margin-top:12px!important}
 .authPanel input,.authPanel button{width:100%!important;min-height:56px!important;font-size:17px!important}
}
`;
if(css.includes(marker))css=css.slice(0,css.indexOf(marker))+styles;else css+='\n'+styles;
fs.writeFileSync(cssPath,css);

const sw='public/sw.js';
if(fs.existsSync(sw)){
 let w=fs.readFileSync(sw,'utf8');
 w=w.replace(/const CACHE_NAME = '[^']+';/,"const CACHE_NAME = 'rtt-erp-v4-stable-auth';");
 fs.writeFileSync(sw,w);
}
