import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import './BranchProfilePage.css'

function money(value){return `${Number(value||0).toLocaleString('en-US')} IQD`}
function dateTime(value){return value?new Date(value).toLocaleString():'—'}
function whatsappUrl(value){
  const raw=String(value||'').trim()
  if(!raw)return ''
  if(/^https?:\/\//i.test(raw))return raw
  let digits=raw.replace(/\D/g,'')
  if(digits.startsWith('00'))digits=digits.slice(2)
  if(digits.startsWith('0'))digits=`964${digits.slice(1)}`
  else if(!digits.startsWith('964'))digits=`964${digits}`
  return digits?`https://wa.me/${digits}`:''
}

export default function BranchProfilePage({ branchId, onBack, onEdit }){
  const [data,setData]=useState(null)
  const [tab,setTab]=useState('overview')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)

  async function load(){
    setLoading(true);setError('')
    try{setData(await api(`/branches/${branchId}/profile`))}
    catch(e){setError(e.message)}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[branchId])

  const maxValue=useMemo(()=>Math.max(1,...(data?.performance||[]).flatMap(row=>[row.revenue,row.expenses])),[data])
  if(loading)return <section className="branchProfileLoading"><div className="loader"/><p>Loading branch profile…</p></section>
  if(error)return <><button className="profileBack" onClick={onBack}>← Back to Branches</button><div className="alert">{error}</div></>
  if(!data)return null
  const {branch,summary,users,performance,audit_history}=data
  const branchWhatsappUrl=whatsappUrl(branch.whatsapp)

  return <section className="branchProfilePage">
    <div className="profileBreadcrumb"><button onClick={onBack}>Branches</button><span>›</span><strong>{branch.name}</strong></div>
    <header className="branchHero" style={branch.cover_image?{backgroundImage:`linear-gradient(110deg,rgba(16,31,25,.92),rgba(16,31,25,.68)),url(${branch.cover_image})`}:{}}>
      <div className="branchHeroIdentity">{branch.logo?<img src={branch.logo} alt=""/>:<div className="heroMonogram">{branch.code?.slice(0,2)||'RT'}</div>}<div><span className="eyebrow">Branch Profile</span><h2>{branch.name}</h2><p>{branch.code} · {[branch.city,branch.country].filter(Boolean).join(', ')}</p><span className={`profileStatus ${branch.active?'active':'inactive'}`}>{branch.active?'Active Branch':'Inactive Branch'}</span></div></div>
      <div className="branchHeroActions"><button className="secondaryButton" onClick={load}>Refresh</button><button className="primaryButton" onClick={()=>onEdit(branch)}>Edit Branch</button></div>
    </header>

    <section className="profileMetrics">
      <article><span>Total Revenue</span><strong>{money(summary.total_revenue)}</strong></article>
      <article><span>Total Expenses</span><strong>{money(summary.total_expenses)}</strong></article>
      <article className="profit"><span>Net Profit</span><strong>{money(summary.net_profit)}</strong></article>
      <article><span>Assigned Users</span><strong>{summary.users}</strong></article>
      <article><span>Pending Approvals</span><strong>{summary.pending_approvals}</strong></article>
    </section>

    <nav className="profileTabs">
      {['overview','financial','users','performance','documents','audit'].map(item=><button key={item} className={tab===item?'active':''} onClick={()=>setTab(item)}>{item==='audit'?'Audit History':item[0].toUpperCase()+item.slice(1)}</button>)}
    </nav>

    {tab==='overview'&&<div className="profileTwoColumn">
      <article className="profilePanel"><h3>Branch Information</h3><dl className="profileDetails"><div><dt>Manager</dt><dd>{branch.manager_name||'Not assigned'}</dd></div><div><dt>Opening Date</dt><dd>{branch.opening_date||'—'}</dd></div><div><dt>Phone</dt><dd>{branch.phone||'—'}</dd></div><div><dt>WhatsApp</dt><dd>{branchWhatsappUrl?<a href={branchWhatsappUrl} target="_blank" rel="noopener noreferrer" title="Open WhatsApp in a new tab" onDoubleClick={(event)=>{event.preventDefault();window.open(branchWhatsappUrl,'_blank','noopener,noreferrer')}}>{branchWhatsappUrl}</a>:'—'}</dd></div><div><dt>Email</dt><dd>{branch.email||'—'}</dd></div><div><dt>Address</dt><dd>{branch.address||'—'}</dd></div><div><dt>Created</dt><dd>{dateTime(branch.created_at)}</dd></div><div><dt>Last Updated</dt><dd>{dateTime(branch.updated_at)}</dd></div></dl></article>
      <article className="profilePanel"><h3>Administrative Notes</h3><p className="profileNotes">{branch.notes||'No administrative notes have been added for this branch.'}</p><div className="overviewMiniStats"><div><span>Revenue Records</span><strong>{branch.revenue_count}</strong></div><div><span>Expense Records</span><strong>{branch.expense_count}</strong></div><div><span>Approved Entries</span><strong>{summary.approved_entries}</strong></div></div></article>
    </div>}

    {tab==='financial'&&<div className="profileTwoColumn"><article className="profilePanel"><h3>Financial Summary</h3><div className="financialStack"><div><span>Gross Revenue</span><strong>{money(summary.total_revenue)}</strong></div><div><span>Allocated Expenses</span><strong>{money(summary.total_expenses)}</strong></div><div className="net"><span>Net Profit</span><strong>{money(summary.net_profit)}</strong></div></div></article><article className="profilePanel"><h3>Current Operational Status</h3><div className="financialStack"><div><span>Pending Approvals</span><strong>{summary.pending_approvals}</strong></div><div><span>Approved Entries</span><strong>{summary.approved_entries}</strong></div><div><span>Total Financial Records</span><strong>{branch.revenue_count+branch.expense_count}</strong></div></div></article></div>}

    {tab==='users'&&<article className="profilePanel"><div className="panelHeading"><div><h3>Assigned Users</h3><p>Users who have access to this branch.</p></div><span>{users.length} users</span></div>{users.length?<div className="profileTableWrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Contact</th><th>Status</th><th>Last Login</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><strong>{user.full_name||user.username}</strong></td><td>{user.username}</td><td>{user.role}</td><td>{user.email||user.phone||'—'}</td><td><span className={`profileStatus ${user.active?'active':'inactive'}`}>{user.active?'Active':'Inactive'}</span></td><td>{dateTime(user.last_login_at)}</td></tr>)}</tbody></table></div>:<div className="emptyProfileState">No users are assigned to this branch.</div>}</article>}

    {tab==='performance'&&<article className="profilePanel"><div className="panelHeading"><div><h3>12-Month Performance</h3><p>Revenue, expenses, and net profit by month.</p></div></div><div className="performanceChart">{performance.map(row=><div className="performanceMonth" key={row.month}><div className="barArea"><span className="bar revenue" style={{height:`${Math.max(3,row.revenue/maxValue*100)}%`}} title={`Revenue ${money(row.revenue)}`}/><span className="bar expense" style={{height:`${Math.max(3,row.expenses/maxValue*100)}%`}} title={`Expenses ${money(row.expenses)}`}/></div><strong>{row.month.slice(5)}</strong><small className={row.net_profit>=0?'positive':'negative'}>{Number(row.net_profit).toLocaleString()}</small></div>)}</div><div className="chartLegend"><span><i className="revenue"/> Revenue</span><span><i className="expense"/> Expenses</span></div></article>}

    {tab==='documents'&&<article className="profilePanel"><h3>Branch Documents</h3><div className="emptyProfileState"><strong>Document storage foundation is ready.</strong><p>Rental contracts, licenses, tax records, and administrative files will appear here in the next document-management phase.</p></div></article>}

    {tab==='audit'&&<article className="profilePanel"><div className="panelHeading"><div><h3>Audit History</h3><p>Latest operations related to this branch.</p></div><span>{audit_history.length} records</span></div>{audit_history.length?<div className="auditTimeline">{audit_history.map(item=><div key={item.id}><span className={`auditDot ${item.result}`}/><section><header><strong>{item.action.replaceAll('_',' ')}</strong><time>{dateTime(item.created_at)}</time></header><p>{item.description}</p><small>{item.username} · {item.role||'—'} · {item.ip_address||'Unknown IP'}</small></section></div>)}</div>:<div className="emptyProfileState">No branch-specific audit records are available yet.</div>}</article>}
  </section>
}