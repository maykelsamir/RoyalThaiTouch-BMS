import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

function formatIQD(value) {
  return `${Number(value || 0).toLocaleString('en-US')} IQD`
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export default function DailyApprovalPage() {
  const [entries, setEntries] = useState([])
  const [branches, setBranches] = useState([])
  const [filters, setFilters] = useState({ status: 'submitted', branchId: '', dateFrom: '', dateTo: '' })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [report, setReport] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')

  async function loadBranches() {
    try { setBranches(await api('/daily-revenue/branches')) } catch { setBranches([]) }
  }

  async function loadEntries() {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ status: filters.status })
    if (filters.branchId) params.set('branch_id', filters.branchId)
    if (filters.dateFrom) params.set('date_from', filters.dateFrom)
    if (filters.dateTo) params.set('date_to', filters.dateTo)
    try {
      setEntries(await api(`/daily-approval?${params.toString()}`))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBranches() }, [])
  useEffect(() => { loadEntries() }, [filters.status, filters.branchId, filters.dateFrom, filters.dateTo])

  async function approve(entry) {
    if (!window.confirm(`Approve ${entry.branch_name} revenue for ${entry.business_date}?`)) return
    setBusyId(entry.id); setError(''); setSuccess('')
    try {
      await api(`/daily-approval/${entry.id}/approve`, { method: 'POST' })
      setSuccess('Revenue entry approved successfully.')
      await loadEntries()
    } catch (requestError) { setError(requestError.message) } finally { setBusyId(null) }
  }

  async function reject(event) {
    event.preventDefault()
    if (!rejecting || reason.trim().length < 3) return
    setBusyId(rejecting.id); setError(''); setSuccess('')
    try {
      await api(`/daily-approval/${rejecting.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) })
      setSuccess('Revenue entry rejected and the reason was saved.')
      setRejecting(null); setReason('')
      await loadEntries()
    } catch (requestError) { setError(requestError.message) } finally { setBusyId(null) }
  }

  const totals = useMemo(() => ({
    count: entries.length,
    amount: entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
  }), [entries])

  return (
    <>
      <div className="pageTitleRow">
        <div><span className="eyebrow">Revenue Control</span><h2>Daily Approval</h2><p>Review submitted branch revenue, inspect the paper report, then approve or reject it.</p></div>
        <button className="secondaryButton" onClick={loadEntries} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      {error && <div className="dashboardAlert">{error}</div>}
      {success && <div className="successAlert">{success}</div>}

      <section className="approvalSummary">
        <div><span>Matching Entries</span><strong>{totals.count}</strong></div>
        <div><span>Total Revenue</span><strong>{formatIQD(totals.amount)}</strong></div>
      </section>

      <section className="approvalPanel">
        <div className="approvalFilters">
          <label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="submitted">Pending Approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label>
          <label>Branch<select value={filters.branchId} onChange={(event) => setFilters({ ...filters, branchId: event.target.value })}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label>From<input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
          <label>To<input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
        </div>

        {loading ? <div className="emptyState">Loading approval entries…</div> : entries.length === 0 ? <div className="emptyState">No entries match the selected filters.</div> : (
          <div className="approvalList">
            {entries.map((entry) => (
              <article className="approvalCard" key={entry.id}>
                <div className="approvalCardTop">
                  <div><span className="eyebrow">{entry.business_date}</span><h3>{entry.branch_name}</h3><p>Entered by {entry.created_by_username || 'Unknown user'} · {formatDateTime(entry.created_at)}</p></div>
                  <div className="approvalAmount"><strong>{formatIQD(entry.amount)}</strong><span className={`statusBadge status-${entry.status}`}>{entry.status}</span></div>
                </div>
                {entry.notes && <div className="approvalNotes">{entry.notes}</div>}
                {entry.rejection_reason && <div className="rejectionNotice"><strong>Rejection reason:</strong> {entry.rejection_reason}</div>}
                <div className="approvalMeta">
                  {entry.approved_at && <span>Approved by {entry.approved_by_username || 'Unknown'} on {formatDateTime(entry.approved_at)}</span>}
                  {entry.rejected_at && <span>Rejected by {entry.rejected_by_username || 'Unknown'} on {formatDateTime(entry.rejected_at)}</span>}
                </div>
                <div className="approvalActions">
                  <button className="secondaryButton" disabled={!entry.report_image} onClick={() => setReport(entry)}>View Report</button>
                  {entry.status === 'submitted' && <><button className="approveButton" disabled={busyId === entry.id} onClick={() => approve(entry)}>{busyId === entry.id ? 'Working…' : 'Approve'}</button><button className="rejectButton" disabled={busyId === entry.id} onClick={() => { setRejecting(entry); setReason('') }}>Reject</button></>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {report && <div className="modalBackdrop" role="presentation" onClick={() => setReport(null)}><div className="reportModal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="modalHeader"><div><span className="eyebrow">Paper Report</span><h3>{report.branch_name} · {report.business_date}</h3></div><button onClick={() => setReport(null)}>×</button></div><img src={report.report_image} alt={`Revenue report for ${report.branch_name}`} /></div></div>}

      {rejecting && <div className="modalBackdrop" role="presentation" onClick={() => setRejecting(null)}><form className="rejectModal" onSubmit={reject} onClick={(event) => event.stopPropagation()}><div className="modalHeader"><div><span className="eyebrow">Reject Entry</span><h3>{rejecting.branch_name} · {rejecting.business_date}</h3></div><button type="button" onClick={() => setRejecting(null)}>×</button></div><label>Reason for rejection<textarea autoFocus required minLength={3} maxLength={1000} rows={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain what must be corrected before resubmission…" /></label><div className="modalActions"><button type="button" className="secondaryButton" onClick={() => setRejecting(null)}>Cancel</button><button className="rejectButton" disabled={busyId === rejecting.id || reason.trim().length < 3}>{busyId === rejecting.id ? 'Rejecting…' : 'Confirm Rejection'}</button></div></form></div>}
    </>
  )
}
