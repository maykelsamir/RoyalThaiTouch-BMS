import { useEffect, useState } from 'react'
import { api, clearTokens, getAccessToken, getRefreshToken, saveTokens } from './api/client'
import './styles.css'

const emptyCredentials = { username: '', password: '' }

function Brand() {
  return (
    <div className="brandBlock">
      <div className="brandMark">RT</div>
      <div>
        <h1>Royal Thai Touch</h1>
        <p>ERP v2.0</p>
      </div>
    </div>
  )
}

function AuthCard({ initialized, onAuthenticated }) {
  const [form, setForm] = useState(emptyCredentials)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setMessage('')

    if (!initialized && form.password !== confirmPassword) {
      setMessage('Passwords do not match')
      return
    }

    setBusy(true)
    try {
      if (!initialized) {
        await api('/auth/setup', {
          method: 'POST',
          body: JSON.stringify(form),
        })
      }

      const tokens = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      saveTokens(tokens)
      const user = await api('/auth/me')
      onAuthenticated(user)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="authPage">
      <section className="authCard">
        <Brand />
        <div className="authHeader">
          <span className="eyebrow">{initialized ? 'Secure Login' : 'First Administrator Setup'}</span>
          <h2>{initialized ? 'Welcome back' : 'Create the first Admin account'}</h2>
          <p>
            {initialized
              ? 'Sign in to Royal Thai Touch ERP.'
              : 'This page will be disabled automatically after the first administrator is created.'}
          </p>
        </div>

        {message && <div className="alert">{message}</div>}

        <form onSubmit={submit} className="authForm">
          <label>
            Username
            <input
              autoComplete="username"
              required
              minLength={3}
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={initialized ? 'current-password' : 'new-password'}
              required
              minLength={initialized ? 4 : 8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          {!initialized && (
            <label>
              Confirm Password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          )}
          <button className="primaryButton" disabled={busy}>
            {busy ? 'Please wait…' : initialized ? 'Login' : 'Create Admin & Login'}
          </button>
        </form>
      </section>
    </main>
  )
}

function Dashboard({ user, onLogout }) {
  return (
    <main className="appPage">
      <header className="appHeader">
        <Brand />
        <div className="headerActions">
          <div className="userBadge">
            <strong>{user.username}</strong>
            <span>{user.role}</span>
          </div>
          <button className="secondaryButton" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <section className="welcomePanel">
        <span className="eyebrow">Authenticated Session</span>
        <h2>Royal Thai Touch ERP v2.0 is ready</h2>
        <p>Your account is authenticated through the new JWT backend. Dashboard modules will be added here without patch files.</p>
      </section>

      <section className="moduleGrid">
        <article><span>01</span><h3>Dashboard</h3><p>Branch and company performance.</p></article>
        <article><span>02</span><h3>Daily Entry</h3><p>Secure revenue submissions and approvals.</p></article>
        <article><span>03</span><h3>Finance</h3><p>Monthly status, expenses, and reports.</p></article>
        <article><span>04</span><h3>Administration</h3><p>Users, roles, permissions, and audit logs.</p></article>
      </section>
    </main>
  )
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

        if (setup.initialized && (getAccessToken() || getRefreshToken())) {
          try {
            const currentUser = await api('/auth/me')
            if (active) setUser(currentUser)
          } catch {
            clearTokens()
          }
        }
      } catch (error) {
        if (active) setStartupError(error.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    bootstrap()
    return () => { active = false }
  }, [])

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // Local logout still completes if the API is temporarily unavailable.
    }
    clearTokens()
    setUser(null)
  }

  if (loading) {
    return <main className="loadingPage"><div className="loader"/><p>Loading Royal Thai Touch ERP…</p></main>
  }

  if (startupError) {
    return (
      <main className="loadingPage">
        <div className="errorCard">
          <h2>Unable to connect to ERP v2</h2>
          <p>{startupError}</p>
          <button className="primaryButton" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </main>
    )
  }

  if (!user) {
    return <AuthCard initialized={initialized} onAuthenticated={(authenticatedUser) => {
      setInitialized(true)
      setUser(authenticatedUser)
    }} />
  }

  return <Dashboard user={user} onLogout={logout} />
}
