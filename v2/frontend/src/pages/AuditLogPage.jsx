import { useEffect, useState } from 'react'
import { api, apiDownload } from '../api/client'
import './AuditLogPage.css'

const emptyFilters = { search: '', username: '', module: '', action: '', result: '', dateFrom: '', dateTo: '' }

export default function AuditLogPage() {
  const [filters, setFilters] = useState(emptyFilters)
  const [data, setData] = useState(null)
  const [options, setOptions] = useState({ users: [], modules: [], actions: [] })
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function query() {
    const params = new URLSearchParams({ page: '1', page_size: '100' })
    if (filters.search) params.set('search', filters.search)
    if (filters.username) params.set('username', filters.username)
    if (filters.module) params.set('module', filters.module)
    if (filters.action) params.set('action', filters.action)
    if (filters.result) params.set('result', filters.result)
    if (filters.dateFrom) params.set('date_from', filters.dateFrom)
    if (filters.dateTo) params.set('date_to', filters.dateTo)
    return params.toString()
  }

  async function load() {
    setLoading(true); setError('')
    try { setData(await api(`/audit?${query()}`)) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    async function bootstrap() {
      try { setOptions(await api('/audit/options')); await load() } catch (e) { setError(e.message) }
    }
    bootstrap()
  }, [])

  return <>
    <div className="pageTitleRow"><div><span className="eyebrow">Security & Compliance</span><h2>Audit Log</h2><p>Review every important operation, user, result, IP address, and affected module.</p></div><button className="secondaryButton" onClick={() => apiDownload(`/audit/export/csv?${query()}`, 'audit_log.csv')}>Export CSV</button></div>
    {error && <div className="alert">{error}</div>}
    {data && <section className="auditMetrics">
      <article><span>Operations Today</span><strong>{data.summary.total_today}</strong></article>
      <article><span>Login Events</span><strong>{data.summary.login_events}</strong></article>
      <article><span>Changes</span><strong>{data.summary.changes}</strong></article>
      <article><span>Approvals</span><strong>{data.summary.approvals}</strong></article>
      <article className="failedMetric"><span>Failed</span><strong>{data.summary.failed}</strong></article>
    </section>}
    <section className="auditPanel">
      <div className="auditFilters">
        <label>Search<input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="User, action, IP, description…" /></label>
        <label>User<select value={filters.username} onChange={(e) => setFilters({ ...filters, username: e.target.value })}><option value="">All users</option>{options.users.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Module<select value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}><option value="">All modules</option>{options.modules.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Action<select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}><option value="">All actions</option>{options.actions.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Result<select value={filters.result} onChange={(e) => setFilters({ ...filters, result: e.target.value })}><option value="">All results</option><option value="success">Success</option><option value="failed">Failed</option></select></label>
        <label>From<input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} /></label>
        <label>To<input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} /></label>
        <div className="auditFilterActions"><button className="secondaryButton" onClick={() => setFilters(emptyFilters)}>Clear</button><button className="primaryButton" disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Apply Filters'}</button></div>
      </div>
      <div className="responsiveTable"><table className="auditTable"><thead><tr><th>Date & Time</th><th>User</th><th>Module</th><th>Action</th><th>Result</th><th>IP</th><th>Details</th></tr></thead><tbody>{data?.items.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td><strong>{item.username}</strong><span>{item.role}</span></td><td>{item.module}</td><td>{item.action.replaceAll('_', ' ')}</td><td><span className={`auditResult audit-${item.result}`}>{item.result}</span></td><td>{item.ip_address || '—'}</td><td><button className="auditViewButton" onClick={() => setSelected(item)}>View</button></td></tr>)}</tbody></table></div>
      {!data?.items.length && <div className="emptyState">No audit records match the selected filters.</div>}
    </section>
    {selected && <div className="modalBackdrop" onClick={() => setSelected(null)}><section className="auditModal" onClick={(e) => e.stopPropagation()}><div className="modalHeader"><div><span className="eyebrow">Audit #{selected.id}</span><h3>{selected.action.replaceAll('_', ' ')}</h3></div><button onClick={() => setSelected(null)}>×</button></div><div className="auditDetailGrid"><div><span>User</span><strong>{selected.username} · {selected.role}</strong></div><div><span>Date</span><strong>{new Date(selected.created_at).toLocaleString()}</strong></div><div><span>Module</span><strong>{selected.module}</strong></div><div><span>Result</span><strong>{selected.result}</strong></div><div><span>Request</span><strong>{selected.request_method} {selected.request_path}</strong></div><div><span>IP Address</span><strong>{selected.ip_address || '—'}</strong></div></div><p className="auditDescription">{selected.description}</p><h4>Before</h4><pre>{JSON.stringify(selected.before_data, null, 2)}</pre><h4>After</h4><pre>{JSON.stringify(selected.after_data, null, 2)}</pre><h4>User Agent</h4><p className="auditAgent">{selected.user_agent || '—'}</p></section></div>}
  </>
}
