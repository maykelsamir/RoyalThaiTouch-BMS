import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import './MonthlyExpensesPage.css'

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatIQD(value) {
  return `${Number(value || 0).toLocaleString('en-US')} IQD`
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function sourceMonth(item) {
  if (!item.source_year || !item.source_month) return ''
  return `${item.source_year}-${String(item.source_month).padStart(2, '0')}`
}

export default function MonthlyExpensesPage({ user }) {
  const [period, setPeriod] = useState(monthValue())
  const [items, setItems] = useState([])
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [year, month] = period.split('-').map(Number)
  const isAdmin = user.role.toLowerCase() === 'admin'

  async function load() {
    setError('')
    try {
      const data = await api(`/monthly-expenses?year=${year}&month=${month}`)
      setItems(data)
      setDrafts(Object.fromEntries(data.map((item) => [item.branch_id, { amount: String(item.amount || 0), notes: item.notes || '' }])))
    } catch (requestError) { setError(requestError.message) }
  }

  useEffect(() => { load() }, [period])

  const dailyTotal = useMemo(() => items.reduce((sum, item) => sum + Number(drafts[item.branch_id]?.amount || 0), 0), [items, drafts])
  const projectedMonthTotal = dailyTotal * daysInMonth(year, month)

  async function save(item) {
    setBusyId(item.branch_id); setError(''); setMessage('')
    try {
      const draft = drafts[item.branch_id]
      await api('/monthly-expenses', {
        method: 'PUT',
        body: JSON.stringify({ branch_id: item.branch_id, year, month, amount: Number(draft.amount || 0), notes: draft.notes || '' }),
      })
      setMessage(`${item.branch_name} fixed daily expense saved successfully.`)
      await load()
    } catch (requestError) { setError(requestError.message) } finally { setBusyId(null) }
  }

  return <>
    <div className="pageTitleRow"><div><span className="eyebrow">Daily Fixed Cost</span><h2>Branch Expenses</h2><p>Set the fixed expense charged every day for each center. If no new value is saved, the latest previous rate continues automatically.</p></div><label className="periodPicker">Effective month<input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label></div>
    {error && <div className="alert">{error}</div>}
    {message && <div className="successAlert">{message}</div>}
    <section className="expenseTotalCard"><span>Total fixed expense per day — all centers</span><strong>{formatIQD(dailyTotal)}</strong><small>Projected full-month total: {formatIQD(projectedMonthTotal)} ({daysInMonth(year, month)} days)</small></section>
    {!isAdmin && <div className="comingSoon">You can review fixed daily expenses, but only an administrator can change them.</div>}
    <section className="monthlyExpenseGrid">
      {items.map((item) => <article className="monthlyExpenseCard" key={item.branch_id}>
        <div className="panelHeading"><span className="eyebrow">Center</span><h3>{item.branch_name}</h3>{item.inherited && <small>Using the saved rate from {sourceMonth(item)} until a new value is saved.</small>}</div>
        <label>Fixed expense per day<input type="number" min="0" step="1000" disabled={!isAdmin} value={drafts[item.branch_id]?.amount ?? ''} onChange={(event) => setDrafts({ ...drafts, [item.branch_id]: { ...drafts[item.branch_id], amount: event.target.value } })} /></label>
        <label>Notes<textarea rows="3" disabled={!isAdmin} value={drafts[item.branch_id]?.notes ?? ''} onChange={(event) => setDrafts({ ...drafts, [item.branch_id]: { ...drafts[item.branch_id], notes: event.target.value } })} /></label>
        <div className="expenseCardFooter"><div><strong>{formatIQD(drafts[item.branch_id]?.amount)} / day</strong><small>Projected month: {formatIQD(Number(drafts[item.branch_id]?.amount || 0) * daysInMonth(year, month))}</small></div>{isAdmin && <button className="primaryButton" disabled={busyId === item.branch_id} onClick={() => save(item)}>{busyId === item.branch_id ? 'Saving…' : item.inherited ? 'Save as new monthly rate' : 'Save daily expense'}</button>}</div>
      </article>)}
    </section>
  </>
}
