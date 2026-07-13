const fs=require('fs');
const jsxPath='src/main.jsx';
const cssPath='src/style.css';
let s=fs.readFileSync(jsxPath,'utf8');

// Give the authentication wrapper and form stable classes. Remove the fixed inline width
// that prevented the mobile form from expanding to the viewport.
s=s.replace(
  /<div className="appShell" style=\{\{alignItems:'center',justifyContent:'center',padding:24\}\}><form className="panel" style=\{\{width:'min\(460px,94vw\)'\}\}/g,
  '<div className="appShell authShell"><form className="panel authPanel"'
);

// Fallback for slightly different generated formatting.
s=s.replace(
  /<div className="appShell" style=\{\{alignItems:'center',justifyContent:'center',padding:\s*24\}\}><form className="panel" style=\{\{width:\s*'min\(460px,94vw\)'\}\}/g,
  '<div className="appShell authShell"><form className="panel authPanel"'
);

if(!s.includes('className="appShell authShell"')){
  console.error('AuthScreen wrapper was not found');
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
    padding:max(18px,env(safe-area-inset-top)) 18px max(18px,env(safe-area-inset-bottom))!important;
    align-items:stretch!important;
    justify-content:stretch!important;
    background:#042B34!important;
  }
  .authPanel{
    width:100%!important;
    max-width:none!important;
    min-height:calc(100dvh - max(36px,env(safe-area-inset-top)) - max(36px,env(safe-area-inset-bottom)))!important;
    margin:0!important;
    padding:clamp(22px,6vw,34px)!important;
    border-radius:22px!important;
    display:flex!important;
    flex-direction:column!important;
    justify-content:center!important;
    box-sizing:border-box!important;
  }
  .authPanel .brand{width:100%!important;justify-content:center!important;text-align:center!important;margin-bottom:24px!important}
  .authPanel .brandLogo{width:min(72vw,360px)!important;height:auto!important;min-height:150px!important;margin:0 auto 16px!important}
  .authPanel h1{font-size:clamp(30px,8vw,42px)!important}
  .authPanel h3{font-size:22px!important;margin:12px 0 18px!important}
  .authPanel label{font-size:17px!important;margin-top:12px!important}
  .authPanel input{width:100%!important;min-height:56px!important;font-size:18px!important;margin-top:7px!important}
  .authPanel button{width:100%!important;min-height:56px!important;font-size:17px!important;margin-top:14px!important}
}
`;
if(css.includes(marker)) css=css.slice(0,css.indexOf(marker))+patch;
else css+='\n'+patch;
fs.writeFileSync(cssPath,css);
