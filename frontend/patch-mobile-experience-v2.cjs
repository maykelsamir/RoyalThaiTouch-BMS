const fs=require('fs');
const p='src/main.jsx';
const cssPath='src/style.css';
let s=fs.readFileSync(p,'utf8');

// Prevent accidental duplicate daily-entry submissions on touch devices.
s=s.replace(
  "async function saveEntry(e){e.preventDefault();",
  "async function saveEntry(e){e.preventDefault();if(window.__rttEntrySubmitting)return;window.__rttEntrySubmitting=true;setTimeout(()=>{window.__rttEntrySubmitting=false},2500);"
);

// Compress employee/document images before storing or uploading them.
const fileRegex=/function fileToBase64\(field,file\)\{[\s\S]*?\}async function addEmployee/;
if(fileRegex.test(s)){
 const compressed=`function fileToBase64(field,file){if(!file)return;if(!file.type.startsWith('image/'))return setMessage('Please select an image file');if(file.size>12*1024*1024)return setMessage('Image is too large. Maximum size is 12 MB');const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1600;const ratio=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.78);setEmployeeForm(x=>({...x,[field]:data}));setMessage('Image compressed and ready')};img.onerror=()=>setMessage('Unable to read image');img.src=reader.result};reader.readAsDataURL(file)}async function addEmployee`;
 s=s.replace(fileRegex,compressed);
}

// Pull-to-refresh for mobile. It only runs when the page is already at the top.
const effectAnchor="useEffect(()=>{if(current)loadData().catch(()=>setMessage('Backend is starting. Please wait 30 seconds then refresh.'))},[current]);";
if(s.includes(effectAnchor)&&!s.includes('rttPullStart')){
 const pullEffect=`useEffect(()=>{if(!current)return;let rttPullStart=0;const start=e=>{if(window.scrollY===0)rttPullStart=e.touches?.[0]?.clientY||0};const end=e=>{const y=e.changedTouches?.[0]?.clientY||0;if(rttPullStart&&y-rttPullStart>90){setMessage('Refreshing...');loadData().then(()=>setMessage('Updated')).catch(()=>setMessage('Unable to refresh'))}rttPullStart=0};window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchend',end,{passive:true});return()=>{window.removeEventListener('touchstart',start);window.removeEventListener('touchend',end)}},[current,businessDate]);`;
 s=s.replace(effectAnchor,effectAnchor+pullEffect);
}

// Add a mobile bottom navigation and a fixed submit action on Daily Entry.
if(!s.includes('className="mobileBottomNav"')){
 const mobileUi=`{page==='entry'&&<button type="button" className="mobileEntrySave" onClick={()=>document.querySelector('.entryPanel')?.requestSubmit()}><Save size={20}/><span>{isManager()?'Save Day':'Submit'}</span></button>}<nav className="mobileBottomNav" aria-label="Mobile navigation"><button className={page==='dashboard'?'active':''} onClick={()=>setPage('dashboard')}><BarChart3 size={21}/><span>Home</span></button><button className={page==='entry'?'active':''} onClick={()=>setPage('entry')}><Save size={21}/><span>Entry</span></button>{isManager()&&<button className={page==='entry'&&visiblePending.length?'active':''} onClick={()=>setPage('entry')}><ListChecks size={21}/><span>Approvals</span>{visiblePending.length>0&&<b>{visiblePending.length}</b>}</button>}<button className={page==='reports'?'active':''} onClick={()=>{setPage('reports');setTimeout(loadReport,100)}}><FileText size={21}/><span>Reports</span></button><button onClick={()=>document.querySelector('.sidebar')?.classList.toggle('mobileOpen')}><Settings size={21}/><span>More</span></button></nav>`;
 const last='</main></div>';
 const index=s.lastIndexOf(last);
 if(index<0){console.error('App closing markup not found');process.exit(1)}
 s=s.slice(0,index)+'</main>'+mobileUi+'</div>'+s.slice(index+last.length);
}

fs.writeFileSync(p,s);

let css=fs.readFileSync(cssPath,'utf8');
const marker='/* Mobile experience v2 */';
const styles=`
/* Mobile experience v2 */
.mobileBottomNav,.mobileEntrySave{display:none}
@media(max-width:768px){
 body{padding-bottom:calc(76px + env(safe-area-inset-bottom))!important}
 .content{padding-bottom:118px!important}
 .sidebar{transition:transform .22s ease!important;z-index:15000!important}
 .sidebar.mobileOpen{display:flex!important;transform:translateX(0)!important}
 .mobileBottomNav{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:14000;min-height:68px;padding:7px 6px calc(7px + env(safe-area-inset-bottom));background:rgba(4,43,52,.97);border-top:1px solid rgba(212,175,55,.28);backdrop-filter:blur(18px);box-shadow:0 -10px 30px rgba(0,0,0,.32)}
 .mobileBottomNav button{position:relative;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;min-width:0!important;min-height:52px!important;margin:0!important;padding:5px 2px!important;border:0!important;background:transparent!important;color:#a9bcc0!important;box-shadow:none!important;font-size:10px!important;border-radius:12px!important}
 .mobileBottomNav button.active{color:#f2d16a!important;background:rgba(212,175,55,.12)!important}
 .mobileBottomNav button b{position:absolute;top:1px;right:18%;min-width:18px;height:18px;padding:0 4px;border-radius:99px;background:#ef4444;color:#fff;font-size:10px;line-height:18px}
 .mobileEntrySave{display:flex;position:fixed;right:16px;bottom:calc(82px + env(safe-area-inset-bottom));z-index:13950;align-items:center;justify-content:center;gap:8px;width:auto!important;min-width:132px!important;min-height:50px!important;padding:0 18px!important;border-radius:999px!important;background:#d4af37!important;color:#042B34!important;box-shadow:0 12px 30px rgba(0,0,0,.38)!important;font-weight:800!important}
 .entryPanel .primaryBtn{margin-bottom:8px!important}
 input,select,textarea,button{font-size:16px!important}
 .panel{scroll-margin-bottom:100px}
}
`;
if(css.includes(marker))css=css.slice(0,css.indexOf(marker))+styles;else css+='\n'+styles;
fs.writeFileSync(cssPath,css);

const sw='public/sw.js';
if(fs.existsSync(sw)){
 let w=fs.readFileSync(sw,'utf8');
 w=w.replace(/const CACHE_NAME = '[^']+';/,"const CACHE_NAME = 'rtt-erp-v6-mobile-experience';");
 fs.writeFileSync(sw,w);
}
