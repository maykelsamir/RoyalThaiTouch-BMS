const API_BASE = `${window.location.origin}/api`;

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }

  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : response;
}

export { API_BASE };
