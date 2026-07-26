const API_BASE = '/api'

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

function errorMessage(payload, status) {
  if (typeof payload === 'string') return payload || `Request failed (${status})`
  const detail = payload?.detail ?? payload?.message ?? payload
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (typeof item === 'string') return item
      const field = Array.isArray(item?.loc) ? item.loc.filter((part) => part !== 'body').join(' → ') : ''
      const message = item?.msg || item?.message || 'Invalid value'
      return field ? `${field}: ${message}` : message
    }).filter(Boolean)
    if (messages.length) return messages.join(' · ')
  }
  try {
    const text = JSON.stringify(detail)
    if (text && text !== '{}') return text
  } catch {}
  return `Request failed (${status})`
}

async function parseResponse(response) {
  const type = response.headers.get('content-type') || ''
  const payload = type.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) throw new Error(errorMessage(payload, response.status))
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

export async function apiDownload(path, fallbackName, retry = true) {
  const headers = new Headers()
  const accessToken = getAccessToken()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${API_BASE}${path}`, { headers })
  if (response.status === 401 && retry && getRefreshToken()) {
    await refreshSession()
    return apiDownload(path, fallbackName, false)
  }
  if (!response.ok) {
    const type = response.headers.get('content-type') || ''
    const payload = type.includes('application/json') ? await response.json() : await response.text()
    throw new Error(errorMessage(payload, response.status))
  }
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = match?.[1] || fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}

export { API_BASE }