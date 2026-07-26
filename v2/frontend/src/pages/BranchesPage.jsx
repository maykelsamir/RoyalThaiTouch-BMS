import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import './BranchesPage.css'

const emptyForm = { name:'', code:'', country:'Iraq', city:'', address:'', phone:'', email:'', whatsapp:'', website:'', facebook:'', instagram:'', tiktok:'', youtube:'', telegram:'', snapchat:'', google_maps:'', manager_name:'', opening_date:'', logo:'', cover_image:'', notes:'', active:true }
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SOURCE_SIZE = 8 * 1024 * 1024
const SOCIAL_FIELDS = [
  ['website','Website'],['facebook','Facebook'],['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube'],['telegram','Telegram'],['snapchat','Snapchat'],['google_maps','Google Maps'],
]

function imageToDataUrl(file, kind) {
  return new Promise((resolve, reject) => {
    if (!IMAGE_TYPES.includes(file.type)) return reject(new Error('Please choose a JPG, PNG, or WebP image.'))
    if (file.size > MAX_SOURCE_SIZE) return reject(new Error('The selected image is too large. Maximum source size is 8 MB.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read the selected image.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('The selected file is not a valid image.'))
      image.onload = () => {
        const maxWidth = kind === 'logo' ? 600 : 1600
        const maxHeight = kind === 'logo' ? 600 : 900
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, width, height)
        const outputType = file.type === 'image/png' && kind === 'logo' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(outputType, 0.86))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function BranchesPage({ user, onOpenProfile }) {
  const [branches,setBranches]=useState([])
  const [stats,setStats]=useState({total:0,active:0,inactive:0,managers:0})
  const [form,setForm]=useState(emptyForm)
  const [editing,setEditing]=useState(null)
  const [showForm,setShowForm]=useState(false)
  const [search,setSearch]=useState('')
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [imageBusy,setImageBusy]=useState('')
  const isAdmin=user.role.toLowerCase()==='admin'

  async function load(){
    setError('')
    try { const [items,summary]=await Promise.all([api('/branches'),api('/branches/stats')]); setBranches(items); setStats(summary) }
    catch(e){setError(e.message)}
  }
  useEffect(()=>{load()},[])

  const filtered=useMemo(()=>branches.filter(b=>`${b.name} ${b.code} ${b.city} ${b.manager_name}`.toLowerCase().includes(search.toLowerCase())),[branches,search])
  function startCreate(){setEditing(null);setForm(emptyForm);setShowForm(true);setMessage('');setError('')}
  function startEdit(item){setEditing(item);setForm({...emptyForm,...item,opening_date:item.opening_date||''});setShowForm(true);setMessage('');setError('')}
  function closeForm(){if(busy||imageBusy)return;setShowForm(false);setEditing(null);setForm(emptyForm)}
  async function chooseImage(event, field){
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file)return
    setImageBusy(field);setError('')
    try{const value=await imageToDataUrl(file,field==='logo'?'logo':'cover');setForm(current=>({...current,[field]:value}))}
    catch(err){setError(err.message)}finally{setImageBusy('')}
  }
  async function save(e){
    e.preventDefault();if(busy||imageBusy)return
    setBusy(true);setError('');setMessage('')
    try{
      const path=editing?`/branches/${editing.id}`:'/branches'
      const payload={
        name:String(form.name||'').trim(),code:String(form.code||'').trim(),country:String(form.country||'').trim(),city:String(form.city||'').trim(),address:String(form.address||'').trim(),phone:String(form.phone||'').trim(),email:String(form.email||'').trim(),whatsapp:String(form.whatsapp||'').trim(),website:String(form.website||'').trim(),facebook:String(form.facebook||'').trim(),instagram:String(form.instagram||'').trim(),tiktok:String(form.tiktok||'').trim(),youtube:String(form.youtube||'').trim(),telegram:String(form.telegram||'').trim(),snapchat:String(form.snapchat||'').trim(),google_maps:String(form.google_maps||'').trim(),manager_name:String(form.manager_name||'').trim(),opening_date:form.opening_date||null,logo:form.logo||'',cover_image:form.cover_image||'',notes:String(form.notes||'').trim(),active:Boolean(form.active),
      }
      await api(path,{method:editing?'PUT':'POST',body:JSON.stringify(payload)})
      setShowForm(false);setEditing(null);setForm(emptyForm);await load();setMessage(editing?'Branch updated successfully.':'Branch created successfully.')
    }catch(err){setError(err.message||'Unable to save branch information.')}finally{setBusy(false)}
  }
  async function toggle(item){try{await api(`/branches/${item.id}/status`,{method:'PATCH'});await load()}catch(e){setError(e.message)}}
  async function remove(item){if(!window.confirm(`Delete ${item.name}?`))return;try{await api(`/branches/${item.id}`,{method:'DELETE'});setMessage('Branch deleted.');await load()}catch(e){setError(e.message)}}

  return <>
    <div className="pageTitleRow"><div><span className="eyebrow">Center Directory</span><h2>Branches Management</h2><p>Create, edit, activate, and safely manage every Royal Thai Touch center.</p></div>{isAdmin&&<button className="primaryButton" onClick={startCreate}>+ Add Branch</button>}</div>
    {error&&<div className="alert">{error}</div>}{message&&<div className="successAlert">{message}</div>}
    <section className="branchStats"><article><span>Total Branches</span><strong>{stats.total}</strong></article><article><span>Active</span><strong>{stats.active}</strong></article><article><span>Inactive</span><strong>{stats.inactive}</strong></article><article><span>Managers</span><strong>{stats.managers}</strong></article></section>
    <section className="branchDirectory"><div className="branchToolbar"><input placeholder="Search name, code, city, or manager…" value={search} onChange={e=>setSearch(e.target.value)}/><span>{filtered.length} centers</span></div>
      <div className="branchCards">{filtered.map(item=><article className={`branchProfileCard ${!item.active?'inactive':''}`} key={item.id}>
        <button className="branchCardOpen" onClick={()=>onOpenProfile(item.id)} aria-label={`Open ${item.name} profile`}>
          <div className="branchVisual">{item.logo?<img src={item.logo} alt=""/>:<div>{item.code?.slice(0,2)||'RT'}</div>}<span className={`statusBadge ${item.active?'status-approved':'status-rejected'}`}>{item.active?'Active':'Inactive'}</span></div>
          <div className="branchInfo"><small>{item.code||'NO CODE'}</small><h3>{item.name}</h3><p>{[item.city,item.country].filter(Boolean).join(', ')||'Location not set'}</p><dl><div><dt>Manager</dt><dd>{item.manager_name||'Not assigned'}</dd></div><div><dt>Phone</dt><dd>{item.phone||'—'}</dd></div><div><dt>Users</dt><dd>{item.user_count}</dd></div><div><dt>Records</dt><dd>{item.revenue_count+item.expense_count}</dd></div></dl></div>
        </button>
        <div className="branchActions"><button onClick={()=>onOpenProfile(item.id)}>View Profile</button>{isAdmin&&<><button onClick={()=>startEdit(item)}>Edit</button><button onClick={()=>toggle(item)}>{item.active?'Disable':'Enable'}</button><button className="dangerText" onClick={()=>remove(item)}>Delete</button></>}</div>
      </article>)}</div>
    </section>
    {showForm&&<div className="modalBackdrop"><form className="branchModal" onSubmit={save}><div className="modalHeader"><div><span className="eyebrow">{editing?'Update Center':'New Center'}</span><h3>{editing?editing.name:'Create Branch'}</h3></div><button type="button" disabled={busy||!!imageBusy} onClick={closeForm}>×</button></div>
      <div className="branchFormGrid">
        <label>Branch name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Branch code<input value={form.code} placeholder="Auto generated" onChange={e=>setForm({...form,code:e.target.value})}/></label>
        <label>Country<input value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/></label><label>City<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label>
        <label className="wide">Address<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label><label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>WhatsApp<input value={form.whatsapp} placeholder="Phone number or WhatsApp URL" onChange={e=>setForm({...form,whatsapp:e.target.value})}/></label>
        <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Manager name<input value={form.manager_name} onChange={e=>setForm({...form,manager_name:e.target.value})}/></label><label>Opening date<input type="date" value={form.opening_date||''} onChange={e=>setForm({...form,opening_date:e.target.value})}/></label>
        <div className="branchSocialSection wide"><div><span className="eyebrow">Online Presence</span><h4>Social media and public links</h4><small>Enter a full URL or a platform username. Links will open in a new tab from the branch profile.</small></div><div className="branchSocialGrid">{SOCIAL_FIELDS.map(([key,label])=><label key={key}>{label}<input value={form[key]||''} placeholder={`${label} URL or username`} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}</div></div>
        <div className="branchImageField"><span>Branch logo</span><div className="branchImageUpload">{form.logo?<img className="branchLogoPreview" src={form.logo} alt="Branch logo preview"/>:<div className="branchImagePlaceholder">RT</div>}<div><label className="imageChooseButton">{imageBusy==='logo'?'Processing…':'Upload logo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!imageBusy||busy} onChange={e=>chooseImage(e,'logo')}/></label>{form.logo&&<button type="button" className="imageRemoveButton" disabled={!!imageBusy||busy} onClick={()=>setForm({...form,logo:''})}>Remove</button>}<small>JPG, PNG, or WebP. Resized automatically.</small></div></div></div>
        <div className="branchImageField"><span>Cover photo</span><div className="branchCoverUpload">{form.cover_image?<img className="branchCoverPreview" src={form.cover_image} alt="Branch cover preview"/>:<div className="branchCoverPlaceholder">Cover preview</div>}<div className="branchImageControls"><label className="imageChooseButton">{imageBusy==='cover_image'?'Processing…':'Upload cover photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!imageBusy||busy} onChange={e=>chooseImage(e,'cover_image')}/></label>{form.cover_image&&<button type="button" className="imageRemoveButton" disabled={!!imageBusy||busy} onClick={()=>setForm({...form,cover_image:''})}>Remove</button>}<small>Recommended landscape image. Maximum output 1600 × 900.</small></div></div></div>
        <label className="wide">Notes<textarea rows="4" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><label className="switchRow wide"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active branch</label>
      </div><div className="modalActions"><button type="button" className="secondaryButton" disabled={busy||!!imageBusy} onClick={closeForm}>Cancel</button><button className="primaryButton" disabled={busy||!!imageBusy}>{imageBusy?'Processing image…':busy?'Saving…':'Save Branch'}</button></div></form></div>}
  </>
}
