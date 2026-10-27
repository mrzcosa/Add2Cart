export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export async function apiRequest(path, { method = 'GET', body, idempotencyKey, signal } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  let response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('The Add2Cart service could not be reached. Please try again.', 0)
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(data.error || 'The request could not be completed.', response.status)
  return data
}

export function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `ac-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
