const fs=require('fs');
const jsxPath='src/main.jsx';
const cssPath='src/style.css';
let s=fs.readFileSync(jsxPath,'utf8');

// Remove the large Face ID / Fingerprint setup button wherever an earlier patch inserted it.
s=s.replace(/<button[^>]*className="[^"]*biometricSetupBtn[^"]*"[^>]*onClick=\{enablePasskey\}[^>]*>[\s\S]*?<\/button>/g,'');
s=s.replace(/<button[^>]*onClick=\{enablePasskey\}[^>]*className="[^"]*biometricSetupBtn[^"]*"[^>]*>[\s\S]*?<\/button>/g,'');

// Add one compact setup icon beside the explicit logout button.
if(!s.includes('className="passkeyIconBtn"')){
 const logoutPatterns=[
  /(<button[^>]*onClick=\{logoutAndClear\}[^>]*>\s*<LogOut[^>]*\/>\s*Logout\s*<\/button>)/,
  /(<button[^>]*onClick=\{logoutAndClear\}[^>]*>[\s\S]*?<LogOut[^>]*\/>[\s\S]*?Logout[\s\S]*?<\/button>)/,
  /(<button[^>]*onClick=\{\(\)=>setCurrent\(null\)\}[^>]*>[\s\S]*?<LogOut[^>]*\/>[\s\S]*?Logout[\s\S]*?<\/button>)/
 ];
 let replaced=false;
 for(const pattern of logoutPatterns){
  if(pattern.test(s)){
   s=s.replace(pattern,'<div className="logoutActions"><button type="button" className="passkeyIconBtn" title="Enable Face ID / Fingerprint" aria-label="Enable Face ID or Fingerprint" onClick={enablePasskey}><Lock size={18}/></button>$1</div>');
   replaced=true;
   break;
  }
 }
 if(!replaced){console.error('Logout button not found');process.exit(1)}
}

fs.writeFileSync(jsxPath,s);

let css=fs.readFileSync(cssPath,'utf8');
const marker='/* Passkey icon beside logout */';
const styles=`
/* Passkey icon beside logout */
.logoutActions{display:flex!important;align-items:center!important;gap:8px!important;width:100%!important}
.logoutActions>button:not(.passkeyIconBtn){flex:1!important}
.passkeyIconBtn{width:42px!important;min-width:42px!important;height:42px!important;min-height:42px!important;padding:0!important;margin:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:12px!important;border:1px solid rgba(212,175,55,.38)!important;background:rgba(212,175,55,.10)!important;color:#f4d66f!important;box-shadow:none!important}
.passkeyIconBtn:hover{background:rgba(212,175,55,.20)!important}
@media(max-width:768px){.passkeyIconBtn{width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important}}
`;
if(css.includes(marker))css=css.slice(0,css.indexOf(marker))+styles;else css+='\n'+styles;
fs.writeFileSync(cssPath,css);
