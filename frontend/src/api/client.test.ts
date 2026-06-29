import { afterEach, expect, test, vi } from 'vitest'
import { register, login, postSync, ApiError, AuthError } from './client'

function mockFetch(status: number, json: unknown) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}
afterEach(() => vi.unstubAllGlobals())

test('login returns token and posts to /api/login', async () => {
  const f = mockFetch(200, { token: 'jwt.x' })
  vi.stubGlobal('fetch', f)
  const res = await login('a@b.de', 'secret123')
  expect(res.token).toBe('jwt.x')
  expect(f).toHaveBeenCalledWith('/api/login', expect.objectContaining({ method: 'POST' }))
})

test('postSync sends Bearer token and returns cursor+changes', async () => {
  const f = mockFetch(200, { cursor: 3, changes: [] })
  vi.stubGlobal('fetch', f)
  const res = await postSync('jwt.x', { since: 0, changes: [] })
  expect(res.cursor).toBe(3)
  const [, init] = f.mock.calls[0]
  expect((init as unknown as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jwt.x' })
})

test('401 throws AuthError', async () => {
  vi.stubGlobal('fetch', mockFetch(401, { message: 'Invalid JWT' }))
  await expect(postSync('bad', { since: 0, changes: [] })).rejects.toBeInstanceOf(AuthError)
})

test('500 throws ApiError with status', async () => {
  vi.stubGlobal('fetch', mockFetch(500, { error: 'boom' }))
  await expect(register('a@b.de', 'x')).rejects.toMatchObject({ status: 500 })
  await expect(register('a@b.de', 'x')).rejects.toBeInstanceOf(ApiError)
})
