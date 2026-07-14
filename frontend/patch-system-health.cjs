const fs=require('fs');
const p='src/main.jsx';
const cssPath='src/style.css';
let s=fs.readFileSync(p,'utf8');

// Add the page label even if Settings was removed from the current menu.
if(!s.includes("systemHealth:'System Health'")){
  s=s.replace(/const pageLabels=\{([^}]*)\};/, (m,inner)=>`const pageLabels={${inner.replace(/,?\s*$/,'')},systemHealth:'System Health'};`);
}

if(!s.includes('const[systemHealth,setSystemHealth]')){
  s=s.replace(
    /const\[users,setUsers\]=useState\(\[\]\);/,
    "const[users,setUsers]=useState([]);const[systemHealth,setSystemHealth]=useState(null);const[healthLoading,setHealthLoading]=useState(false);"
  );
}

if(!s.includes('const canViewSystemHealth=')){
  const anchor="const can=p=>";
  const idx=s.indexOf(anchor);
  if(idx<0){console.error('permission anchor not found');process.exit(1)}
  s=s.slice(0,idx)+"const canViewSystemHealth=()=>{const role=String(current?.role||'').trim().toLowerCase();return ['admin','manager','accountant'].includes(role)||current?.permissions?.includes('systemHealth')||current?.permissions?.includes('system_health')||current?.permissions?.includes('users')};"+s.slice(idx);
}

if(!s.includes('async function loadSystemHealth')){
  const anchor='function nav(k,icon,label,fn,force=false)';
  const fn=`async function loadSystemHealth(){setHealthLoading(true);try{const data=await api('/system-health');setSystemHealth(data);setMessage('System health updated')}catch(e){setMessage(e.message||'Unable to load system health')}finally{setHealthLoading(false)}}\n  `;
  if(!s.includes(anchor)){console.error('nav anchor not found');process.exit(1)}
  s=s.replace(anchor,fn+anchor);
}

// Remove any older System Health navigation entry, then insert one directly before logout.
s=s.replace(/\{nav\('systemHealth'[\s\S]*?\)\}/g,'');
const healthNav="{nav('systemHealth',<Settings size={18}/>, 'System Health',()=>{setPage('systemHealth');setTimeout(loadSystemHealth,100)},canViewSystemHealth())}";
const logout='<div className="logoutActions">';
if(!s.includes(logout)){console.error('logout actions not found');process.exit(1)}
s=s.replace(logout,healthNav+logout);

if(!s.includes("page==='systemHealth'")){
  const page=`{page==='systemHealth'&&canViewSystemHealth()&&<><section className="panel"><div className="splitPanel"><div><h3>System Health</h3><p style={{color:'#a1a1aa',marginTop:0}}>Live server, database, storage and backup information.</p></div><button onClick={loadSystemHealth} disabled={healthLoading}><RefreshCcw size={16}/> {healthLoading?'Checking...':'Refresh Status'}</button></div></section>{systemHealth&&<><section className="cards healthCards"><div className="metric"><span>Backend</span><strong className="healthOk">● {systemHealth.backend}</strong></div><div className="metric"><span>PostgreSQL</span><strong className="healthOk">● {systemHealth.database}</strong></div><div className="metric"><span>SSL</span><strong className={systemHealth.ssl==='Active'?'healthOk':'healthWarn'}>{systemHealth.ssl}</strong></div><div className="metric gold"><span>ERP Version</span><strong>{systemHealth.version}</strong></div></section><section className="panel healthGrid"><div><span>Database Size</span><strong>{formatBytes(systemHealth.database_size_bytes)}</strong></div><div><span>Disk Used</span><strong>{systemHealth.disk_used_percent}%</strong><small>{formatBytes(systemHealth.disk_free_bytes)} free</small></div><div><span>Backup Files</span><strong>{systemHealth.backup_count}</strong><small>{formatBytes(systemHealth.backup_total_bytes)}</small></div><div><span>Latest Backup</span><strong>{systemHealth.latest_backup?.name||'Not detected'}</strong><small>{systemHealth.latest_backup?.created_at?new Date(systemHealth.latest_backup.created_at).toLocaleString():'Mount backup folder to detect files'}</small></div><div><span>Active Users</span><strong>{systemHealth.active_users}</strong></div><div><span>Active Centers</span><strong>{systemHealth.active_branches}</strong></div><div><span>Active Employees</span><strong>{systemHealth.active_employees}</strong></div><div><span>Backend Uptime</span><strong>{formatUptime(systemHealth.uptime_seconds)}</strong><small>Python {systemHealth.python_version}</small></div></section></>}</>}`;
  const helpers=`const formatBytes=n=>{const x=Number(n||0);if(x<1024)return x+' B';if(x<1024**2)return (x/1024).toFixed(1)+' KB';if(x<1024**3)return (x/1024**2).toFixed(1)+' MB';return (x/1024**3).toFixed(2)+' GB'};const formatUptime=s=>{const n=Number(s||0),d=Math.floor(n/86400),h=Math.floor(n%86400/3600),m=Math.floor(n%3600/60);return (d?d+'d ':'')+(h?h+'h ':'')+m+'m'};\n`;
  const fmtAnchor="const fmt=v=>'IQD '+Number(v||0).toLocaleString('en-US');";
  if(!s.includes('const formatBytes='))s=s.replace(fmtAnchor,fmtAnchor+helpers);
  const close='</main>';
  const idx=s.lastIndexOf(close);
  if(idx<0){console.error('main closing tag not found');process.exit(1)}
  s=s.slice(0,idx)+page+s.slice(idx);
}

fs.writeFileSync(p,s);

let css=fs.readFileSync(cssPath,'utf8');
const marker='/* System health page */';
const styles=`
/* System health page */
.healthOk{color:#75f09a!important}.healthWarn{color:#f4d66f!important}
.healthGrid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px!important}
.healthGrid>div{display:flex;flex-direction:column;gap:7px;padding:18px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}
.healthGrid span{color:#a9bcc0;font-size:13px}.healthGrid strong{font-size:18px;color:#fff;overflow-wrap:anywhere}.healthGrid small{color:#88a0a6;line-height:1.4}
@media(max-width:768px){.healthGrid{grid-template-columns:1fr 1fr!important}.healthGrid>div{padding:14px}.healthGrid strong{font-size:15px}.healthCards{grid-template-columns:1fr 1fr!important}}
@media(max-width:420px){.healthGrid{grid-template-columns:1fr!important}}
`;
if(css.includes(marker))css=css.slice(0,css.indexOf(marker))+styles;else css+='\n'+styles;
fs.writeFileSync(cssPath,css);

const sw='public/sw.js';if(fs.existsSync(sw)){let w=fs.readFileSync(sw,'utf8');w=w.replace(/const CACHE_NAME = '[^']+';/,"const CACHE_NAME = 'rtt-erp-v8-system-health-visible';");fs.writeFileSync(sw,w)}