import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import './MonthStatusPage.css'

const stateLabels = {
  complete: 'Complete',
  pending: 'Pending Approval',
  draft: 'Draft',
  rejected: 'Rejected',
  missing: 'Missing',
  upcoming: 'Upcoming',
}

const editableStates = [
  { value: 'complete', label: 'Complete' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'draft', label: 'Draft' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'missing', label: 'Missing' },
]

function currentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatIQD(value) {
  return `${Number(value || 0).toLocaleString('en-US')} IQD`
}

function SummaryCard({ label, value, className }) {
  return <div className={`monthSummaryCard ${className || ''}`}><span>{label}</span><strong>{value}</strong></div>
}

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

  async function loadBranches() {
    try { setBranches(await api('/daily-revenue/branches')) } catch (requestError) { setError(requestError.message) }
  }

  async function loadStatus() {
    setLoading(true)
    setError('')
    try {
      const branchQuery = branchId ? `&branch_id=${branchId}` : ''
      setData(await api(`/month-status?year=${year}&month=${month}${branchQuery}`))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBranches() }, [])
  useEffect(() => { loadStatus() }, [year, month, branchId])

  function moveMonth(offset) {
    const next = new Date(year, month - 1 + offset, 1)
    setMonthValue(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }

  async function editDay(branch, day) {
    if (!isAdmin || savingKey) return

    const choices = editableStates.map((item, index) => `${index + 1}. ${item.label}`).join('\n')
    const selected = window.prompt(
      `Change status for ${branch.branch_name} on ${day.date}\n\nCurrent: ${stateLabels[day.state]}\n\nChoose the new status number:\n${choices}`,
    )
    if (selected === null) return

    const selectedState = editableStates[Number(selected) - 1]
    if (!selectedState) {
      window.alert('Invalid selection. Please choose a number from 1 to 5.')
      return
    }
    if (selectedState.value === day.state) return

    const confirmed = window.confirm(
      `WARNING\n\nYou are about to manually change the stored status for ${branch.branch_name} on ${day.date}.\n\nFrom: ${stateLabels[day.state]}\nTo: ${selectedState.label}\n\nThis may affect reports and completion statistics. The change will be recorded in Audit Log.\n\nPress OK to continue.`,
    )
    if (!confirmed) return

    const key = `${branch.branch_id}-${day.date}`
    setSavingKey(key)
    setError('')
    try {
      await api('/month-status/override', {
        method: 'PUT',
        body: JSON.stringify({
          branch_id: branch.branch_id,
          business_date: day.date,
          state: selectedState.value,
        }),
      })
      await loadStatus()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSavingKey('')
    }
  }

  return (
    <>
      <div className="pageTitleRow monthTitleRow">
        <div>
          <span className="eyebrow">Daily Completion Monitor</span>
          <h2>Month Entry Status</h2>
          <p>{isAdmin ? 'Click any day to manually change its stored status. Every change requires confirmation and is recorded in Audit Log.' : 'Track completed, pending, draft, and missing revenue entries for every branch.'}</p>
        </div>
        <button className="secondaryButton" onClick={loadStatus} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <section className="monthToolbar">
        <button className="monthArrow" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button>
        <label>Month<input type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} /></label>
        <label>Branch<select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <button className="monthArrow" onClick={() => moveMonth(1)} aria-label="Next month">›</button>
      </section>

      {error && <div className="dashboardAlert">{error}</div>}

      {data && (
        <>
          <section className="monthOverview">
            <div className="monthOverviewHeading"><span className="eyebrow">Company Overview</span><h3>{data.month_label}</h3><div className="completionRate"><strong>{data.company_completion_rate}%</strong><span>approved completion</span></div></div>
            <div className="monthSummaryGrid">
              <SummaryCard label="Complete" value={data.company_summary.complete} className="summaryComplete" />
              <SummaryCard label="Pending" value={data.company_summary.pending} className="summaryPending" />
              <SummaryCard label="Draft" value={data.company_summary.draft} className="summaryDraft" />
              <SummaryCard label="Missing" value={data.company_summary.missing} className="summaryMissing" />
              <SummaryCard label="Rejected" value={data.company_summary.rejected} className="summaryRejected" />
              <SummaryCard label="Upcoming" value={data.company_summary.upcoming} className="summaryUpcoming" />
            </div>
          </section>

          <div className="monthLegend">
            {Object.entries(stateLabels).map(([state, label]) => <span key={state}><i className={`legendDot day-${state}`} />{label}</span>)}
          </div>

          <section className="branchCalendarList">
            {data.branches.map((branch) => (
              <article className="branchCalendar" key={branch.branch_id}>
                <header className="branchCalendarHeader">
                  <div><span className="eyebrow">Branch</span><h3>{branch.branch_name}</h3></div>
                  <div className="branchProgress"><strong>{branch.completion_rate}%</strong><span>{branch.summary.complete} complete · {branch.summary.missing} missing</span></div>
                </header>
                <div className="weekHeader"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
                <div className="calendarGrid">
                  {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, index) => <div className="calendarBlank" key={`blank-${index}`} />)}
                  {branch.days.map((day) => {
                    const key = `${branch.branch_id}-${day.date}`
                    return (
                      <button
                        type="button"
                        className={`calendarDay day-${day.state}${isAdmin ? ' calendarDayEditable' : ''}`}
                        key={day.date}
                        title={`${day.date} — ${stateLabels[day.state]}${day.amount ? ` — ${formatIQD(day.amount)}` : ''}${isAdmin ? ' — Click to change' : ''}`}
                        onClick={() => editDay(branch, day)}
                        disabled={!isAdmin || savingKey === key}
                      >
                        <div className="calendarDayTop"><strong>{day.day}</strong><span>{savingKey === key ? 'Saving…' : stateLabels[day.state]}</span></div>
                        {day.amount > 0 && <small>{formatIQD(day.amount)}</small>}
                      </button>
                    )
                  })}
                </div>
              </article>
            ))}
            {!data.branches.length && <div className="emptyState">No accessible branches found.</div>}
          </section>
        </>
      )}
    </>
  )
}