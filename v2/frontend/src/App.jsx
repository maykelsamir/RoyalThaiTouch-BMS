import { useEffect, useState } from 'react'
import { api, clearTokens, getAccessToken, getRefreshToken, saveTokens } from './api/client'
import DailyApprovalPage from './pages/DailyApprovalPage'
import DailyRevenuePage from './pages/DailyRevenuePage'
import MonthStatusPage from './pages/MonthStatusPage'
import './styles.css'

const emptyCredentials = { username: '', password: '' }
const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'daily-revenue', label: 'Daily Revenue', icon: '↗' },
  { id: 'expenses', label: 'Expenses', icon: '▤' },
  { id: 'reports', label: 'Financial Reports', icon: '▥' },
  { id: 'month-status', label: 'Month Entry Status', icon: '◫' },
  { id: 'approvals', label: 'Daily Approval', icon: '✓' },
  { id: 'branches', label: 'Branches', icon: '◇' },
  { id: 'users', label: 'Users', icon: '♙' },
  { id: 'permissions', label: 'Roles & Permissions', icon: '⌘' },
  { id: 'backup', label: 'Backup', icon: '↓' },
]

function Brand({ compact = false }) {
  return <div className={`brandBlock ${compact ? 'brandCompact' : ''}`}><div className="brandMark">RT</div><div><h1>Royal Thai Touch</h1><p>ERP v2.0</p></div></div>
}

function formatIQD(value) { return `${Number(value || 0).toLocaleString('en-US')} IQD` }

function AuthCard({ initialized, onAuthenticated }) {
  const [form, setForm] = useState(emptyCredentials)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setMessage('')
    if (!initialized && form.password !== confirmPassword) return setMessage('Passwords do not match')
    setBusy(true)
    try {
      if (!initialized) await api('/auth/setup', { method: 'POST', body: JSON.stringify(form) })
      const tokens = await api('/auth/login', { method: 'POST', body: JSON.stringify(form) })
      saveTokens(tokens)
      onAuthenticated(await api('/auth/me'))
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  return <main className="authPage"><section className="authCard"><Brand /><div className="authHeader"><span className="eyebrow">{initialized ? 'Secure Login' : 'First Administrator Setup'}</span><h2>{initialized ? 'Welcome back' : 'Create the first Admin account'}</h2><p>{initialized ? 'Sign in to Royal Thai Touch ERP.' : 'This page will be disabled automatically after the first administrator is created.'}</p></div>{message && <div className="alert">{message}</div>}<form onSubmit={submit} className="authForm"><label>Username<input autoComplete="username" required minLength={3} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><label>Password<input type="password" autoComplete={initialized ? 'current-password' : 'new-password'} required minLength={initialized ? 4 : 8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>{!initialized && <label>Confirm Password<input type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}<button className="primaryButton" disabled={busy}>{busy ? 'Please wait…' : initialized ? 'Login' : 'Create Admin & Login'}</button></form></section></main>
}

function Metric({ label, value, emphasis = false }) { return <div className={`metric ${emphasis ? 'metricEmphasis' : ''}`}><span>{label}</span><strong>{formatIQD(value)}</strong></div> }

function DashboardPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  async function loadDashboard() {
    setRefreshing(true); setError('')
    try { setData(await api('/dashboard/yesterday')) } catch (requestError) { setError(requestError.message) } finally { setRefreshing(false) }
  }
  useEffect(() => { loadDashboard() }, [])
  return <><div className="pageTitleRow"><div><span className="eyebrow">Yesterday Performance</span><h2>Financial Dashboard</h2><p>{data ? `Business date: ${data.business_date}` : 'Loading previous-day financial results…'}</p></div><button className="secondaryButton" onClick={loadDashboard} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>{error && <div className="dashboardAlert">{error}</div>}{data && <><section className="companyCard"><div><span className="eyebrow">Company Total</span><h3>All Centers Combined</h3></div><div className="companyMetrics"><Metric label="Revenue" value={data.company.revenue} /><Metric label="Expenses" value={data.company.expenses} /><Metric label="Net Profit" value={data.company.net_profit} emphasis /></div></section><section className="branchGrid">{data.branches.map((branch) => <article className="branchCard" key={branch.branch_id}><div className="branchCardHeader"><span>Center</span><h3>{branch.branch_name}</h3></div><Metric label="Revenue" value={branch.revenue} /><Metric label="Expenses" value={branch.expenses} /><Metric label="Net Profit" value={branch.net_profit} emphasis /></article>)}</section></> }</>
}

const pageCopy = {
  expenses: ['Expenses', 'Record and review branch expenses.'], reports: ['Financial Reports', 'Daily, monthly, Excel, and PDF reporting.'],
  branches: ['Branches', 'Manage centers and branch access.'], users: ['Users', 'Manage users, roles, and active accounts.'],
  permissions: ['Roles & Permissions', 'Control access to every ERP operation.'], backup: ['Backup', 'Create and review protected database backups.'],
}

function PlaceholderPage({ page }) {
  const [title, description] = pageCopy[page]
  return <section className="placeholderPanel"><span className="eyebrow">Royal Thai Touch ERP</span><h2>{title}</h2><p>{description}</p><div className="comingSoon">Module foundation is ready. Business forms and API integration are the next implementation step.</div></section>
}

function ApplicationShell({ user, onLogout }) {
  const [page, setPage] = useState('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  function navigate(nextPage) { setPage(nextPage); setMobileOpen(false) }
  const titles = { dashboard: 'Dashboard', 'daily-revenue': 'Daily Revenue', 'month-status': 'Month Entry Status', approvals: 'Daily Approval' }
  const pageTitle = titles[page] || pageCopy[page][0]
  let pageContent
  if (page === 'dashboard') pageContent = <DashboardPage />
  else if (page === 'daily-revenue') pageContent = <DailyRevenuePage />
  else if (page === 'month-status') pageContent = <MonthStatusPage />
  else if (page === 'approvals') pageContent = <DailyApprovalPage />
  else pageContent = <PlaceholderPage page={page} />

  return <div className="shell"><aside className={`sidebar ${mobileOpen ? 'sidebarOpen' : ''}`}><div className="sidebarBrand"><Brand compact /></div><nav className="sideNav">{navigation.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span className="navIcon">{item.icon}</span><span>{item.label}</span></button>)}</nav><div className="sidebarFooter"><div className="sidebarUser"><strong>{user.username}</strong><span>{user.role}</span></div><button className="logoutButton" onClick={onLogout}>Logout</button></div></aside>{mobileOpen && <button className="sidebarBackdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}<main className="workspace"><header className="topbar"><button className="menuButton" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button><div><strong>{pageTitle}</strong><span>Royal Thai Touch ERP v2.0</span></div><div className="topUser"><strong>{user.username}</strong><span>{user.role}</span></div></header><div className="contentArea">{pageContent}</div></main></div>
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(true)
  const [user, setUser] = useState(null)
  const [startupError, setStartupError] = useState('')
  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        const setup = await api('/auth/setup-status')
        if (!active) return
        setInitialized(setup.initialized)
        if (setup.initialized && (getAccessToken() || getRefreshToken())) { try { if (active) setUser(await api('/auth/me')) } catch { clearTokens() } }
      } catch (error) { if (active) setStartupError(error.message) } finally { if (active) setLoading(false) }
    }
    bootstrap(); return () => { active = false }
  }, [])
  async function logout() { try { await api('/auth/logout', { method: 'POST' }) } catch { /* local logout continues */ } clearTokens(); setUser(null) }
  if (loading) return <main className="loadingPage"><div className="loader"/><p>Loading Royal Thai Touch ERP…</p></main>
  if (startupError) return <main className="loadingPage"><div className="errorCard"><h2>Unable to connect to ERP v2</h2><p>{startupError}</p><button className="primaryButton" onClick={() => window.location.reload()}>Retry</button></div></main>
  if (!user) return <AuthCard initialized={initialized} onAuthenticated={(authenticatedUser) => { setInitialized(true); setUser(authenticatedUser) }} />
  return <ApplicationShell user={user} onLogout={logout} />
}
