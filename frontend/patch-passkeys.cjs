const fs = require('fs');
const path = 'src/main.jsx';
let s = fs.readFileSync(path, 'utf8');

const helpers = `
const b64ToBuf=s=>{const p='='.repeat((4-s.length%4)%4);const b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(b,c=>c.charCodeAt(0)).buffer};
const bufToB64=b=>{const a=new Uint8Array(b);let s='';a.forEach(x=>s+=String.fromCharCode(x));return btoa(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'')};
const prepPublicKey=o=>({...o,challenge:b64ToBuf(o.challenge),user:o.user?{...o.user,id:b64ToBuf(o.user.id)}:undefined,excludeCredentials:(o.excludeCredentials||[]).map(x=>({...x,id:b64ToBuf(x.id)})),allowCredentials:(o.allowCredentials||[]).map(x=>({...x,id:b64ToBuf(x.id)}))});
const credentialJSON=c=>({id:c.id,rawId:bufToB64(c.rawId),type:c.type,response:{clientDataJSON:bufToB64(c.response.clientDataJSON),attestationObject:c.response.attestationObject?bufToB64(c.response.attestationObject):undefined,authenticatorData:c.response.authenticatorData?bufToB64(c.response.authenticatorData):undefined,signature:c.response.signature?bufToB64(c.response.signature):undefined,userHandle:c.response.userHandle?bufToB64(c.response.userHandle):null},clientExtensionResults:c.getClientExtensionResults?c.getClientExtensionResults():{}});
`;
if (!s.includes('const b64ToBuf=')) s = s.replace("const fmt=v=>'IQD '+Number(v||0).toLocaleString('en-US');", "const fmt=v=>'IQD '+Number(v||0).toLocaleString('en-US');" + helpers);

const authRegex = /function AuthScreen\([\s\S]*?\n\nfunction App\(\)\{/;
const authReplacement = `function AuthScreen({users,onLogin,onCreateFirstAdmin}){const setup=users.length===0;const[username,setUsername]=useState(''),[secret,setSecret]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);function submit(e){e.preventDefault();setError('');if(setup)return onCreateFirstAdmin(username,secret);const u=users.find(x=>x.username===username&&x.secret===secret&&x.active!==false);if(!u)return setError('Invalid login');onLogin(u)}async function biometric(){if(!username)return setError('Enter username first');if(!window.PublicKeyCredential)return setError('This device does not support Face ID or fingerprint login');setBusy(true);setError('');try{const r=await fetch(API+'/passkeys/auth/options?username='+encodeURIComponent(username));const o=await r.json();if(!r.ok)throw new Error(o.detail||'Passkey is not enabled');const cred=await navigator.credentials.get({publicKey:prepPublicKey(o)});const v=await fetch(API+'/passkeys/auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,credential:credentialJSON(cred)})});const data=await v.json();if(!v.ok)throw new Error(data.detail||'Biometric login failed');onLogin(data.user)}catch(e){setError(e.message||'Biometric login cancelled')}finally{setBusy(false)}}return <div className="appShell" style={{alignItems:'center',justifyContent:'center',padding:24}}><form className="panel" style={{width:'min(460px,94vw)'}} onSubmit={submit}><div className="brand"><div className="brandLogo">RTT</div><div><h1>Royal Thai Touch</h1><span>{setup?'Create Admin User':'ERP Login'}</span></div></div><h3><Lock size={18}/> {setup?'First Admin Setup':'Login'}</h3>{error&&<div className="notice">{error}</div>}<label>Username</label><input value={username} onChange={e=>setUsername(e.target.value)} autoFocus/><label>Password</label><input type="password" value={secret} onChange={e=>setSecret(e.target.value)}/><button className="primaryBtn">{setup?'Create Admin':'Login'}</button>{!setup&&<button type="button" className="secondaryBtn biometricBtn" onClick={biometric} disabled={busy}>{busy?'Checking...':'Use Face ID / Fingerprint'}</button>}</form></div>}

function App(){`;
if (!authRegex.test(s)) { console.error('AuthScreen block not found'); process.exit(1); }
s = s.replace(authRegex, authReplacement);

const apiMarker = "async function bootstrap(){const us=await api('/users');setUsers(us||[])}";
const enableFn = `async function enablePasskey(){if(!window.PublicKeyCredential)return setMessage('This device does not support Face ID or fingerprint login');try{setMessage('Preparing biometric registration...');const r=await fetch(API+'/passkeys/register/options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:current.username,secret:current.secret})});const o=await r.json();if(!r.ok)throw new Error(o.detail||'Could not start registration');const cred=await navigator.credentials.create({publicKey:prepPublicKey(o)});const v=await fetch(API+'/passkeys/register/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:current.username,secret:current.secret,credential:credentialJSON(cred)})});const data=await v.json();if(!v.ok)throw new Error(data.detail||'Could not enable biometric login');setMessage('Face ID / fingerprint login enabled on this device')}catch(e){setMessage(e.message||'Biometric registration cancelled')}}`;
if (!s.includes('async function enablePasskey()')) s = s.replace(apiMarker, apiMarker + enableFn);

const refreshButton = `<button onClick={()=>loadData()}><RefreshCcw size={16}/> Refresh</button>`;
const enhanced = `${refreshButton}<button type="button" className="secondaryBtn biometricSetupBtn" onClick={enablePasskey}>Enable Face ID / Fingerprint</button>`;
s = s.replace(refreshButton, enhanced);

const css = `
.biometricBtn,.biometricSetupBtn{border-color:rgba(212,175,55,.35)!important;background:rgba(212,175,55,.08)!important;color:#f4d66f!important}
@media(max-width:768px){.biometricSetupBtn{width:100%!important;font-size:13px!important}.biometricBtn{margin-top:8px!important}}
`;
const cssPath='src/style.css';let c=fs.readFileSync(cssPath,'utf8');if(!c.includes('.biometricBtn'))fs.writeFileSync(cssPath,c+css);
fs.writeFileSync(path,s);
