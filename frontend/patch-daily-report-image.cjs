const fs=require('fs');
const path='src/main.jsx';
let s=fs.readFileSync(path,'utf8');

s=s.replace(
"const[entry,setEntry]=useState({branch_id:'',business_date:todayISO(),revenue:'',notes:''});",
"const[entry,setEntry]=useState({branch_id:'',business_date:todayISO(),revenue:'',notes:'',report_image:''});const[selectedReportImage,setSelectedReportImage]=useState(null);"
);

s=s.replace(
"submitted_by:current?.username||'-'})",
"submitted_by:current?.username||'-',report_image:entry.report_image||''})"
);

s=s.replace(
"setEntry(p=>({...p,revenue:'',notes:''}));",
"setEntry(p=>({...p,revenue:'',notes:'',report_image:''}));"
);

s=s.replace(
"<label>Revenue Notes</label><textarea value={entry.notes} onChange={e=>setEntry({...entry,notes:e.target.value})}/>",
"<label>Revenue Notes</label><textarea value={entry.notes} onChange={e=>setEntry({...entry,notes:e.target.value})}/><label>Daily Paper Report Image</label><input type=\"file\" accept=\"image/*\" capture=\"environment\" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024){setMessage('Image must be smaller than 8 MB');e.target.value='';return}const r=new FileReader();r.onload=()=>setEntry(x=>({...x,report_image:String(r.result||'')}));r.readAsDataURL(f)}}/>{entry.report_image&&<div className=\"paperReportPreview\"><img src={entry.report_image}/><button type=\"button\" className=\"secondaryBtn\" onClick={()=>setEntry(x=>({...x,report_image:''}))}>Remove Image</button></div>}"
);

s=s.replace(
"<th>Submitted By</th><th>Actions</th>",
"<th>Submitted By</th><th>Paper Report</th><th>Actions</th>"
);

s=s.replace(
"<td>{p.submitted_by}</td><td><div className=\"buttonGroup\">",
"<td>{p.submitted_by}</td><td>{p.report_image?<button type=\"button\" className=\"secondaryBtn\" onClick={()=>setSelectedReportImage({src:p.report_image,branch:p.branch,date:p.business_date,submitted_by:p.submitted_by})}>Open Image</button>:<span style={{color:'#71717a'}}>No image</span>}</td><td><div className=\"buttonGroup\">"
);

const modal=`{selectedReportImage&&<div className=\"reportImageModal\" onClick={()=>setSelectedReportImage(null)}><div className=\"panel reportImageDialog\" onClick={e=>e.stopPropagation()}><div className=\"splitPanel\"><div><h3>Daily Paper Report</h3><p style={{color:'#a1a1aa',margin:0}}>{selectedReportImage.branch} — {selectedReportImage.date} — {selectedReportImage.submitted_by}</p></div><button type=\"button\" onClick={()=>setSelectedReportImage(null)}>Close</button></div><img src={selectedReportImage.src} alt=\"Daily paper report\"/></div></div>}`;
if(!s.includes('className="reportImageModal"')) s=s.replace("{selectedEmployee&&",modal+"{selectedEmployee&&");

fs.writeFileSync(path,s);

const cssPath='src/style.css';
let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('/* Daily paper report image */')) css+=`\n/* Daily paper report image */\n.paperReportPreview{display:grid;gap:10px;margin-top:10px}.paperReportPreview img{max-width:260px;max-height:220px;object-fit:contain;border-radius:14px;border:1px solid rgba(212,175,55,.28);background:#090a0d;padding:6px}.reportImageModal{position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:20px}.reportImageDialog{width:min(1000px,96vw);max-height:94vh;overflow:auto}.reportImageDialog>img{display:block;width:100%;max-height:78vh;object-fit:contain;margin-top:14px;border-radius:14px;background:#08090c}@media(max-width:768px){.paperReportPreview img{max-width:100%;width:100%}.reportImageModal{padding:8px}.reportImageDialog{width:100%;max-height:98vh}}\n`;
fs.writeFileSync(cssPath,css);
