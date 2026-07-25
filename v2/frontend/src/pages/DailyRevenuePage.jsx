import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

const today = new Date().toISOString().slice(0, 10)
const emptyForm = { branch_id: '', business_date: today, amount: '', notes: '', report_image: '' }

function statusLabel(status) {
  return ({ draft: 'Draft', submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected' })[status] || status
}

export default function DailyRevenuePage() {
  const [branches, setBranches] = useState([])
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedBranch = useMemo(() => branches.find((item) => String(item.id) === String(form.branch_id)), [branches, form.branch_id])

  async function load() {
    setError('')
    try {
      const [branchData, entryData] = await Promise.all([api('/daily-revenue/branches'), api('/daily-revenue')])
      setBranches(branchData)
      setEntries(entryData)
      setForm((current) => ({ ...current, branch_id: current.branch_id || String(branchData[0]?.id || '') }))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  useEffect(() => { load() }, [])

  async function fileToDataUrl(file) {
    if (!file) return ''
    if (file.size > 4 * 1024 * 1024) throw new Error('Image must be smaller than 4 MB')
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Unable to read image'))
      reader.readAsDataURL(file)
    })
  }

  async function save(event) {
    event.preventDefault()
    const confirmed = window.confirm(
      'Submit Daily Revenue?\n\nAre you sure you want to submit this daily revenue?\n\nAfter submission, you will not be able to edit it unless it is rejected by an administrator.'
    )
    if (!confirmed) return

    setBusy(true)
    setMessage('')
    setError('')
    try {
      await api('/daily-revenue?submit=true', {
        method: 'POST',
        body: JSON.stringify({ ...form, branch_id: Number(form.branch_id), amount: Number(form.amount) }),
      })
      setMessage(`Daily revenue submitted successfully for ${selectedBranch?.name || 'branch'}.`)
      setForm((current) => ({ ...emptyForm, branch_id: current.branch_id }))
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function submit(entryId) {
    const confirmed = window.confirm('Submit this saved draft for approval?')
    if (!confirmed) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await api(`/daily-revenue/${entryId}/submit`, { method: 'POST' })
      setMessage('Revenue entry submitted for approval.')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="pageTitleRow">
        <div>
          <span className="eyebrow">Branch Operations</span>
          <h2>Daily Revenue</h2>
          <p>Enter the branch revenue, attach the paper report, then submit it directly for approval. Zero is accepted as a valid daily revenue.</p>
        </div>
        <button className="secondaryButton" onClick={load} disabled={busy}>Refresh</button>
      </div>

      {error && <div className="dashboardAlert">{error}</div>}
      {message && <div className="successAlert">{message}</div>}

      <section className="revenueLayout">
        <form className="revenueForm" onSubmit={save}>
          <div className="panelHeading"><span className="eyebrow">New Entry</span><h3>Revenue Information</h3></div>
          <div className="formGrid">
            <label>Branch<select required value={form.branch_id} onChange={(event) => setForm({ ...form, branch_id: event.target.value })}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
            <label>Business Date<input required type="date" value={form.business_date} onChange={(event) => setForm({ ...form, business_date: event.target.value })} /></label>
            <label className="fullField">Revenue Amount (IQD)<input required min="0" step="1" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0" /></label>
            <label className="fullField">Notes<textarea rows="4" maxLength="1000" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional notes about the daily revenue" /></label>
            <label className="fullField">Paper Report Image<input accept="image/*" type="file" onChange={async (event) => {
              try { setForm({ ...form, report_image: await fileToDataUrl(event.target.files?.[0]) }) } catch (fileError) { setError(fileError.message) }
            }} /></label>
          </div>
          {form.report_image && <img className="reportPreview" src={form.report_image} alt="Paper report preview" />}
          <button className="primaryButton" disabled={busy || !branches.length}>{busy ? 'Submitting…' : 'Submit'}</button>
        </form>

        <section className="revenueHistory">
          <div className="panelHeading"><span className="eyebrow">Recent Entries</span><h3>Revenue History</h3></div>
          <div className="entryList">
            {entries.length === 0 && <div className="emptyState">No revenue entries have been created yet.</div>}
            {entries.map((entry) => (
              <article className="revenueEntry" key={entry.id}>
                <div><strong>{entry.branch_name}</strong><span>{entry.business_date}</span></div>
                <div className="entryAmount">{Number(entry.amount).toLocaleString('en-US')} IQD</div>
                <span className={`statusBadge status-${entry.status}`}>{statusLabel(entry.status)}</span>
                {entry.status === 'draft' && <button className="secondaryButton compactButton" disabled={busy} onClick={() => submit(entry.id)}>Submit</button>}
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  )
}
