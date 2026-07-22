const API_BASE = `${window.location.protocol}//${window.location.hostname}:18000/api`

const ACCESS_KEY = 'rtt_v2_access_token'
const REFRESH_KEY = 'rtt_v2_refresh_token'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function saveTokens(tokens) {
  localStorage.setItem(ACCESS_KEY, tokens.access_token)
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function parseResponse(response) {
  const type = response.headers.get('content-type') || ''
  const payload = type.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    const message = typeof payload === 'object' ? payload.detail : payload
    throw new Error(message || `Request failed (${response.status})`)
  }
  return payload
}

export async function refreshSession() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('No refresh token')
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const tokens = await parseResponse(response)
  saveTokens(tokens)
  return tokens
}

export async function api(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  const accessToken = getAccessToken()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (response.status === 401 && retry && getRefreshToken()) {
    try {
      await refreshSession()
      return api(path, options, false)
    } catch {
      clearTokens()
    }
  }
  return parseResponse(response)
}

export { API_BASE }
