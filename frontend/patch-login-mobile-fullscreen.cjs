const fs=require('fs');
const jsxPath='src/main.jsx';
let s=fs.readFileSync(jsxPath,'utf8');

s=s.replace(
  '<div className="appShell" style={{alignItems:\'center\',justifyContent:\'center\',padding:24}}><form className="panel" style={{width:\'min(460px,94vw)\'}}',
  '<div className="appShell loginShell" style={{alignItems:\'center\',justifyContent:\'center\',padding:24}}><form className="panel loginPanel" style={{width:\'min(460px,94vw)\'}}'
);

if(!s.includes('className="appShell loginShell"')){
  console.error('Login screen markup not found');
  process.exit(1);
}
fs.writeFileSync(jsxPath,s);

const cssPath='src/style.css';
let css=fs.readFileSync(cssPath,'utf8');
const marker='/* Full-screen mobile login */';
const styles=`
/* Full-screen mobile login */
.loginShell{width:100%;min-height:100vh;min-height:100dvh;box-sizing:border-box}
.loginPanel{box-sizing:border-box}
@media(max-width:768px){
  html,body,#root{width:100%;min-height:100%;margin:0}
  .loginShell{min-height:100vh!important;min-height:100dvh!important;width:100vw!important;padding:0!important;align-items:stretch!important;justify-content:flex-start!important;background:#042B34!important}
  .loginPanel{width:100vw!important;max-width:none!important;min-height:100vh!important;min-height:100dvh!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:max(34px,env(safe-area-inset-top)) 24px max(28px,env(safe-area-inset-bottom))!important;display:flex!important;flex-direction:column!important;justify-content:center!important;background:linear-gradient(180deg,#063945 0%,#042B34 100%)!important}
  .loginPanel .brand{width:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;padding:0 0 24px!important;margin-bottom:24px!important}
  .loginPanel .brandLogo{width:min(78vw,340px)!important;height:auto!important;min-height:180px!important;border-radius:20px!important;margin:0 auto 18px!important;background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important}
  .loginPanel .brand h1{font-size:clamp(30px,8vw,42px)!important;margin:0 0 6px!important}
  .loginPanel .brand span{font-size:16px!important}
  .loginPanel h3{font-size:22px!important;margin:0 0 18px!important}
  .loginPanel label{font-size:16px!important;margin-top:12px!important}
  .loginPanel input{width:100%!important;min-height:56px!important;font-size:18px!important;padding:14px 16px!important}
  .loginPanel button{width:100%!important;min-height:56px!important;font-size:17px!important;margin-top:14px!important}
  .loginPanel .notice{font-size:15px!important;padding:14px!important}
}
`;
if(css.includes(marker))css=css.slice(0,css.indexOf(marker))+styles;else css+=styles;
fs.writeFileSync(cssPath,css);
