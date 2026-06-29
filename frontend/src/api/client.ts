import type { SyncResponse } from '../types'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}
export class AuthError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message)
    this.name = 'AuthError'
  }
}

async function request<T>(
  path: string,
  opts: { method: string; body?: unknown; token?: string },
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  if (res.status === 401) throw new AuthError()
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j.error ?? j.message ?? msg
    } catch { /* keep default */ }
    throw new ApiError(res.status, msg)
  }
  return (await res.json()) as T
}

export function register(email: string, password: string) {
  return request<{ id: string; email: string }>('/register', { method: 'POST', body: { email, password } })
}

export function login(email: string, password: string) {
  return request<{ token: string }>('/login', { method: 'POST', body: { email, password } })
}

export function postSync(token: string, body: { since: number; changes: unknown[] }) {
  return request<SyncResponse>('/sync', { method: 'POST', body, token })
}
