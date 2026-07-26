import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import './MonthStatusPage.css'

const stateLabels = { complete: 'Complete', pending: 'Pending Approval', draft: 'Draft', rejected: 'Rejected', missing: 'Missing', upcoming: 'Upcoming' }
const editableStates = ['complete', 'pending', 'draft', 'rejected', 'missing']
function currentMonthValue() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }
function formatIQD(value) { return `${Number(value || 0).toLocaleString('en-US')} IQD` }
function formatCount(value) { return Number(value || 0).toLocaleString('en-US') }
function SummaryCard({ label, value, className }) { return <div className={`monthSummaryCard ${className || ''}`}><span>{label}</span><strong>{value}</strong></div> }

export default function MonthStatusPage({ user }) {
  const [monthValue, setMonthValue] = useState(currentMonthValue())
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editForm, setEditForm] = useState(null)
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin'
  const [year, month] = useMemo(() => monthValue.split('-').map(Number), [monthValue])

  async function loadBranches() { try { setBranches(await api('/daily-revenue/branches')) } catch (requestError) { setError(requestError.message) } }
  async function loadStatus() { setLoading(true); setError(''); try { const branchQuery = branchId ? `&branch_id=${branchId}` : ''; setData(await api(`/month-status?year=${year}&month=${month}${branchQuery}`)) } catch (requestError) { setError(requestError.message) } finally { setLoading(false) } }
  useEffect(() => { loadBranches() }, [])
  useEffect(() => { loadStatus() }, [year, month, branchId])
  function moveMonth(offset) { const next = new Date(year, month - 1 + offset, 1); setMonthValue(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`) }

  function openEditor(branch, day) {
    if (!isAdmin || day.state === 'upcoming' || savingKey) return
    setError(''); setSuccess('')
    setEditForm({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
      business_date: day.date,
      amount: String(Number(day.amount || 0)),
      customer_count: String(Number(day.customer_count || 0)),
      state: day.state,
      notes: day.notes || '',
      reason: '',
      original: day,
    })
  }

  function updateDayImmediately(result) {
    setData((current) => {
      if (!current) return current
      const branchesNext = current.branches.map((branch) => {
        if (branch.branch_id !== result.branch_id) return branch
        const days = branch.days.map((day) => day.date === result.business_date ? { ...day, entry_id: result.entry_id, state: result.state, status: result.status, amount: result.amount, customer_count: result.customer_count, notes: result.notes } : day)
        const summary = { complete: 0, pending: 0, draft: 0, rejected: 0, missing: 0, upcoming: 0 }
        let totalCustomers = 0
        days.forEach((day) => { summary[day.state] += 1; totalCustomers += Number(day.customer_count || 0) })
        const elapsed = ['complete', 'pending', 'draft', 'rejected', 'missing'].reduce((sum, key) => sum + summary[key], 0)
        return { ...branch, days, summary, total_customers: totalCustomers, completion_rate: elapsed ? Math.round((summary.complete / elapsed) * 1000) / 10 : 0 }
      })
      const companySummary = { complete: 0, pending: 0, draft: 0, rejected: 0, missing: 0, upcoming: 0 }
      let companyCustomers = 0
      branchesNext.forEach((branch) => { Object.keys(companySummary).forEach((key) => { companySummary[key] += branch.summary[key] }); companyCustomers += branch.total_customers })
      const elapsedCompany = ['complete', 'pending', 'draft', 'rejected', 'missing'].reduce((sum, key) => sum + companySummary[key], 0)
      return { ...current, branches: branchesNext, company_summary: companySummary, company_total_customers: companyCustomers, company_completion_rate: elapsedCompany ? Math.round((companySummary.complete / elapsedCompany) * 1000) / 10 : 0 }
    })
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!editForm || savingKey) return
    const amount = Number(String(editForm.amount).replace(/,/g, '').trim())
    const customerCount = Number(String(editForm.customer_count).replace(/,/g, '').trim())
    const reason = editForm.reason.trim()
    if (!Number.isFinite(amount) || amount < 0) return setError('Revenue amount must be zero or greater.')
    if (!Number.isInteger(customerCount) || customerCount < 0) return setError('Number of customers must be a whole number zero or greater.')
    if (reason.length < 3) return setError('Reason for change is required.')
    const warning = `WARNING\n\nYou are changing a financial record.\n\nBranch: ${editForm.branch_name}\nDate: ${editForm.business_date}\nRevenue: ${formatIQD(editForm.original.amount)} → ${formatIQD(amount)}\nCustomers: ${formatCount(editForm.original.customer_count)} → ${formatCount(customerCount)}\nStatus: ${stateLabels[editForm.original.state]} → ${stateLabels[editForm.state]}\n\nThis action will be recorded permanently in the Audit Log. Continue?`
    if (!window.confirm(warning)) return
    const key = `${editForm.branch_id}-${editForm.business_date}`
    setSavingKey(key); setError(''); setSuccess('')
    try {
      const result = await api('/month-status/edit', { method: 'PUT', body: JSON.stringify({ branch_id: editForm.branch_id, business_date: editForm.business_date, amount, customer_count: customerCount, state: editForm.state, notes: editForm.notes, reason }) })
      updateDayImmediately(result)
      setEditForm(null)
      setSuccess('Entry updated successfully. The new value and status are now visible and the change was recorded in Audit Log.')
      loadStatus()
    } catch (requestError) { setError(requestError.message) } finally { setSavingKey('') }
  }

  return <>
    <div className="pageTitleRow monthTitleRow"><div><span className="eyebrow">Daily Completion Monitor</span><h2>Month Entry Status</h2><p>Track revenue entry status, daily customers, and total monthly customer traffic for every center.</p></div><button className="secondaryButton" onClick={loadStatus} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    <section className="monthToolbar"><button className="monthArrow" onClick={() => moveMonth(-1)}>‹</button><label>Month<input type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} /></label><label>Branch<select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><button className="monthArrow" onClick={() => moveMonth(1)}>›</button></section>
    {error && <div className="dashboardAlert">{error}</div>}
    {success && <div className="monthSuccess">{success}</div>}
    {data && <>
      <section className="monthOverview"><div className="monthOverviewHeading"><span className="eyebrow">Company Overview</span><h3>{data.month_label}</h3><div className="completionRate"><strong>{data.company_completion_rate}%</strong><span>approved completion</span></div></div><div className="monthSummaryGrid"><SummaryCard label="Customers" value={formatCount(data.company_total_customers)} className="summaryComplete" /><SummaryCard label="Complete" value={data.company_summary.complete} className="summaryComplete" /><SummaryCard label="Pending" value={data.company_summary.pending} className="summaryPending" /><SummaryCard label="Draft" value={data.company_summary.draft} className="summaryDraft" /><SummaryCard label="Missing" value={data.company_summary.missing} className="summaryMissing" /><SummaryCard label="Rejected" value={data.company_summary.rejected} className="summaryRejected" /><SummaryCard label="Upcoming" value={data.company_summary.upcoming} className="summaryUpcoming" /></div></section>
      <div className="monthLegend">{Object.entries(stateLabels).map(([state, label]) => <span key={state}><i className={`legendDot day-${state}`} />{label}</span>)}</div>
      <section className="branchCalendarList">{data.branches.map((branch) => <article className="branchCalendar" key={branch.branch_id}><header className="branchCalendarHeader"><div><span className="eyebrow">Branch</span><h3>{branch.branch_name}</h3><small>{formatCount(branch.total_customers)} customers this month</small></div><div className="branchProgress"><strong>{branch.completion_rate}%</strong><span>{branch.summary.complete} complete · {branch.summary.missing} missing</span></div></header><div className="weekHeader"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div className="calendarGrid">{Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, index) => <div className="calendarBlank" key={`blank-${index}`} />)}{branch.days.map((day) => { const key = `${branch.branch_id}-${day.date}`; const editable = isAdmin && day.state !== 'upcoming'; return <button type="button" className={`calendarDay day-${day.state}${editable ? ' calendarDayEditable' : ''}`} key={day.date} title={`${day.date} — ${stateLabels[day.state]} — ${formatIQD(day.amount)} — ${formatCount(day.customer_count)} customers${editable ? ' — Click to edit' : ''}`} onClick={() => openEditor(branch, day)} disabled={!editable || savingKey === key}><div className="calendarDayTop"><strong>{day.day}</strong><span>{savingKey === key ? 'Saving…' : stateLabels[day.state]}</span></div><small>{formatIQD(day.amount)}</small><small>{formatCount(day.customer_count)} customers</small>{editable && <em>Edit</em>}</button> })}</div></article>)}{!data.branches.length && <div className="emptyState">No accessible branches found.</div>}</section>
    </>}
    {editForm && <div className="monthEditOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingKey) setEditForm(null) }}><form className="monthEditModal" onSubmit={saveEdit}><div className="monthEditHeader"><div><span className="eyebrow">Administrator Action</span><h3>Edit Month Entry</h3><p>{editForm.branch_name} · {editForm.business_date}</p></div><button type="button" className="monthEditClose" onClick={() => setEditForm(null)} disabled={Boolean(savingKey)}>×</button></div><div className="monthEditWarning"><strong>Warning</strong><span>This change affects financial records immediately and will be permanently recorded in the Audit Log.</span></div><div className="monthEditGrid"><label>Revenue Amount (IQD)<input type="number" min="0" value={editForm.amount} onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })} /></label><label>Number of Customers<input type="number" min="0" step="1" value={editForm.customer_count} onChange={(event) => setEditForm({ ...editForm, customer_count: event.target.value })} /></label><label>Status<select value={editForm.state} onChange={(event) => setEditForm({ ...editForm, state: event.target.value })}>{editableStates.map((state) => <option value={state} key={state}>{stateLabels[state]}</option>)}</select></label><label className="monthEditWide">Notes<textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} placeholder="Optional notes" /></label><label className="monthEditWide">Reason for Change *<textarea required minLength="3" value={editForm.reason} onChange={(event) => setEditForm({ ...editForm, reason: event.target.value })} placeholder="Explain why this record is being changed" /></label></div><div className="monthEditActions"><button type="button" className="secondaryButton" onClick={() => setEditForm(null)} disabled={Boolean(savingKey)}>Cancel</button><button className="primaryButton" disabled={Boolean(savingKey)}>{savingKey ? 'Applying Change…' : 'Confirm Update'}</button></div></form></div>}
  </>
}