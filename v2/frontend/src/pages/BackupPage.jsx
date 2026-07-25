import { useEffect, useState } from 'react'
import { api, apiDownload } from '../api/client'

const BACKUP_API = '/auth/backup'

function formatSize(bytes) {
  const value = Number(bytes || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024 ** 3).toFixed(2)} GB`
}

export default function BackupPage() {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setError('')
    try { setItems(await api(BACKUP_API)) } catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [])

  async function createBackup() {
    setBusy('create'); setError(''); setMessage('')
    try {
      const result = await api(BACKUP_API, { method: 'POST' })
      setMessage(`Backup created: ${result.filename}`)
      await load()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function restoreBackup(filename) {
    const confirmation = window.prompt(`Restoring ${filename} will replace the current database. Type RESTORE to continue.`)
    if (confirmation !== 'RESTORE') return
    setBusy(filename); setError(''); setMessage('')
    try {
      const result = await api(`${BACKUP_API}/restore`, { method: 'POST', body: JSON.stringify({ filename, confirmation }) })
      setMessage(result.message)
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  async function deleteBackup(filename) {
    if (!window.confirm(`Delete backup ${filename}? This cannot be undone.`)) return
    setBusy(filename); setError(''); setMessage('')
    try {
      await api(`${BACKUP_API}/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      setMessage('Backup deleted.')
      await load()
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  return <>
    <div className="pageTitleRow">
      <div><span className="eyebrow">Database Protection</span><h2>Backup System</h2><p>Create, download, restore, and remove protected PostgreSQL backups.</p></div>
      <button className="primaryButton" onClick={createBackup} disabled={Boolean(busy)}>{busy === 'create' ? 'Creating backup…' : 'Create New Backup'}</button>
    </div>
    {error && <div className="dashboardAlert">{error}</div>}
    {message && <div className="companyCard"><strong>{message}</strong></div>}
    <section className="companyCard" style={{ display: 'block' }}>
      <div className="pageTitleRow"><div><span className="eyebrow">Backup History</span><h3>Stored Backups</h3></div><button className="secondaryButton" onClick={load} disabled={Boolean(busy)}>Refresh</button></div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ textAlign: 'left', padding: 12 }}>File</th><th style={{ textAlign: 'left', padding: 12 }}>Created</th><th style={{ textAlign: 'left', padding: 12 }}>Size</th><th style={{ textAlign: 'right', padding: 12 }}>Actions</th></tr></thead>
        <tbody>
          {items.map((item) => <tr key={item.filename} style={{ borderTop: '1px solid rgba(128,128,128,.25)' }}>
            <td style={{ padding: 12 }}><strong>{item.filename}</strong></td><td style={{ padding: 12 }}>{new Date(item.created_at).toLocaleString()}</td><td style={{ padding: 12 }}>{formatSize(item.size)}</td>
            <td style={{ padding: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button className="secondaryButton" onClick={() => apiDownload(`${BACKUP_API}/${encodeURIComponent(item.filename)}/download`, item.filename)} disabled={Boolean(busy)}>Download</button>{' '}
              <button className="secondaryButton" onClick={() => restoreBackup(item.filename)} disabled={Boolean(busy)}>{busy === item.filename ? 'Working…' : 'Restore'}</button>{' '}
              <button className="logoutButton" onClick={() => deleteBackup(item.filename)} disabled={Boolean(busy)}>Delete</button>
            </td>
          </tr>)}
          {!items.length && <tr><td colSpan="4" style={{ padding: 24, textAlign: 'center' }}>No backups have been created yet.</td></tr>}
        </tbody>
      </table></div>
    </section>
  </>
}
