import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import './MonthStatusPage.css'

const stateLabels = { complete: 'Complete', pending: 'Pending Approval', draft: 'Draft', rejected: 'Rejected', missing: 'Missing', upcoming: 'Upcoming' }
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
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin'
  const [year, month] = useMemo(() => monthValue.split('-').map(Number), [monthValue])

  async function loadBranches() { try { setBranches(await api('/daily-revenue/branches')) } catch (requestError) { setError(requestError.message) } }
  async function loadStatus() { setLoading(true); setError(''); try { const branchQuery = branchId ? `&branch_id=${branchId}` : ''; setData(await api(`/month-status?year=${year}&month=${month}${branchQuery}`)) } catch (requestError) { setError(requestError.message) } finally { setLoading(false) } }
  useEffect(() => { loadBranches() }, [])
  useEffect(() => { loadStatus() }, [year, month, branchId])
  function moveMonth(offset) { const next = new Date(year, month - 1 + offset, 1); setMonthValue(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`) }

  async function editAmount(branch, day) {
    if (!isAdmin || savingKey) return
    const currentAmount = Number(day.amount || 0)
    const entered = window.prompt(`Edit daily revenue\n\nBranch: ${branch.branch_name}\nDate: ${day.date}\nCustomers: ${formatCount(day.customer_count)}\nCurrent amount: ${formatIQD(currentAmount)}\n\nEnter the new amount in IQD:`, String(currentAmount))
    if (entered === null) return
    const normalized = entered.replace(/,/g, '').trim(); const newAmount = Number(normalized)
    if (!normalized || !Number.isFinite(newAmount) || newAmount < 0) return window.alert('Please enter a valid amount greater than or equal to zero.')
    if (newAmount === currentAmount || !window.confirm(`WARNING\n\nBranch: ${branch.branch_name}\nDate: ${day.date}\nFrom: ${formatIQD(currentAmount)}\nTo: ${formatIQD(newAmount)}\n\nThis change will be recorded in Audit Log.`)) return
    const key = `${branch.branch_id}-${day.date}`; setSavingKey(key); setError('')
    try { await api('/month-status/amount', { method: 'PUT', body: JSON.stringify({ branch_id: branch.branch_id, business_date: day.date, amount: newAmount }) }); await loadStatus() } catch (requestError) { setError(requestError.message) } finally { setSavingKey('') }
  }

  return <>
    <div className="pageTitleRow monthTitleRow"><div><span className="eyebrow">Daily Completion Monitor</span><h2>Month Entry Status</h2><p>Track revenue entry status, daily customers, and total monthly customer traffic for every center.</p></div><button className="secondaryButton" onClick={loadStatus} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    <section className="monthToolbar"><button className="monthArrow" onClick={() => moveMonth(-1)}>‹</button><label>Month<input type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} /></label><label>Branch<select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><button className="monthArrow" onClick={() => moveMonth(1)}>›</button></section>
    {error && <div className="dashboardAlert">{error}</div>}
    {data && <>
      <section className="monthOverview"><div className="monthOverviewHeading"><span className="eyebrow">Company Overview</span><h3>{data.month_label}</h3><div className="completionRate"><strong>{data.company_completion_rate}%</strong><span>approved completion</span></div></div><div className="monthSummaryGrid"><SummaryCard label="Customers" value={formatCount(data.company_total_customers)} className="summaryComplete" /><SummaryCard label="Complete" value={data.company_summary.complete} className="summaryComplete" /><SummaryCard label="Pending" value={data.company_summary.pending} className="summaryPending" /><SummaryCard label="Draft" value={data.company_summary.draft} className="summaryDraft" /><SummaryCard label="Missing" value={data.company_summary.missing} className="summaryMissing" /><SummaryCard label="Rejected" value={data.company_summary.rejected} className="summaryRejected" /><SummaryCard label="Upcoming" value={data.company_summary.upcoming} className="summaryUpcoming" /></div></section>
      <div className="monthLegend">{Object.entries(stateLabels).map(([state, label]) => <span key={state}><i className={`legendDot day-${state}`} />{label}</span>)}</div>
      <section className="branchCalendarList">{data.branches.map((branch) => <article className="branchCalendar" key={branch.branch_id}><header className="branchCalendarHeader"><div><span className="eyebrow">Branch</span><h3>{branch.branch_name}</h3><small>{formatCount(branch.total_customers)} customers this month</small></div><div className="branchProgress"><strong>{branch.completion_rate}%</strong><span>{branch.summary.complete} complete · {branch.summary.missing} missing</span></div></header><div className="weekHeader"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div className="calendarGrid">{Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, index) => <div className="calendarBlank" key={`blank-${index}`} />)}{branch.days.map((day) => { const key = `${branch.branch_id}-${day.date}`; return <button type="button" className={`calendarDay day-${day.state}${isAdmin ? ' calendarDayEditable' : ''}`} key={day.date} title={`${day.date} — ${stateLabels[day.state]} — ${formatIQD(day.amount)} — ${formatCount(day.customer_count)} customers`} onClick={() => editAmount(branch, day)} disabled={!isAdmin || savingKey === key}><div className="calendarDayTop"><strong>{day.day}</strong><span>{savingKey === key ? 'Saving…' : stateLabels[day.state]}</span></div><small>{formatIQD(day.amount)}</small><small>{formatCount(day.customer_count)} customers</small></button> })}</div></article>)}{!data.branches.length && <div className="emptyState">No accessible branches found.</div>}</section>
    </>}
  </>
}
