const fs=require('fs');
const jsxPath='src/main.jsx';
const cssPath='src/style.css';
let s=fs.readFileSync(jsxPath,'utf8');

// Convert either the original login markup or the markup produced by the
// previous mobile-login patch into stable fullscreen classes.
if(!s.includes('className="appShell authShell"')){
  s=s.replace(
    /<div className="appShell" style=\{\{alignItems:'center',justifyContent:'center',padding:\s*24\}\}><form className="panel" style=\{\{width:\s*'min\(460px,94vw\)'\}\}/g,
    '<div className="appShell authShell"><form className="panel authPanel"'
  );

  s=s.replace(
    /<div className="appShell loginShell"[^>]*><form className="panel loginPanel"[^>]*>/g,
    '<div className="appShell authShell"><form className="panel authPanel">'
  );

  s=s.replace(
    /className="appShell loginShell"/g,
    'className="appShell authShell"'
  );
  s=s.replace(
    /className="panel loginPanel"/g,
    'className="panel authPanel"'
  );
}

if(!s.includes('className="appShell authShell"')||!s.includes('className="panel authPanel"')){
  console.error('Authentication screen markup was not found');
  process.exit(1);
}
fs.writeFileSync(jsxPath,s);

let css=fs.readFileSync(cssPath,'utf8');
const marker='/* Login fullscreen mobile v2 */';
const patch=`
/* Login fullscreen mobile v2 */
.authShell{
  min-height:100vh;
  min-height:100dvh;
  width:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
  box-sizing:border-box;
}
.authPanel{
  width:min(520px,94vw);
  box-sizing:border-box;
}
@media(max-width:768px){
  html,body,#root{width:100%;min-height:100%;margin:0;background:#042B34!important}
  body{overflow-x:hidden}
  .authShell{
    width:100vw!important;
    min-width:100vw!important;
    min-height:100vh!important;
    min-height:100dvh!important;
    padding:0!important;
    align-items:stretch!important;
    justify-content:flex-start!important;
    background:#042B34!important;
  }
  .authPanel{
    width:100vw!important;
    max-width:none!important;
    min-height:100vh!important;
    min-height:100dvh!important;
    margin:0!important;
    padding:max(34px,env(safe-area-inset-top)) 24px max(28px,env(safe-area-inset-bottom))!important;
    border:0!important;
    border-radius:0!important;
    box-shadow:none!important;
    display:flex!important;
    flex-direction:column!important;
    justify-content:center!important;
    box-sizing:border-box!important;
    background:linear-gradient(180deg,#063945 0%,#042B34 100%)!important;
  }
  .authPanel .brand{width:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;padding:0 0 24px!important;margin-bottom:24px!important}
  .authPanel .brandLogo{width:min(78vw,340px)!important;height:auto!important;min-height:180px!important;margin:0 auto 18px!important;background-size:contain!important;background-position:center!important;background-repeat:no-repeat!important}
  .authPanel h1{font-size:clamp(30px,8vw,42px)!important;margin:0 0 6px!important}
  .authPanel h3{font-size:22px!important;margin:0 0 18px!important}
  .authPanel label{font-size:17px!important;margin-top:12px!important}
  .authPanel input{width:100%!important;min-height:56px!important;font-size:18px!important;margin-top:7px!important;padding:14px 16px!important}
  .authPanel button{width:100%!important;min-height:56px!important;font-size:17px!important;margin-top:14px!important}
  .authPanel .notice{font-size:15px!important;padding:14px!important}
}
`;
if(css.includes(marker)) css=css.slice(0,css.indexOf(marker))+patch;
else css+='\n'+patch;
fs.writeFileSync(cssPath,css);
