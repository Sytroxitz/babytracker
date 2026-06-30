import { afterEach, expect, test, vi } from 'vitest'
import { register, login, postSync, ApiError, AuthError } from './client'

function mockFetch(status: number, json: unknown) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}
afterEach(() => vi.unstubAllGlobals())

test('login returns token and posts to /api/login', async () => {
  const f = mockFetch(200, { token: 'jwt.x', userId: 'u1' })
  vi.stubGlobal('fetch', f)
  const res = await login('a@b.de', 'secret123')
  expect(res.token).toBe('jwt.x')
  expect(res.userId).toBe('u1')
  expect(f).toHaveBeenCalledWith('/api/login', expect.objectContaining({ method: 'POST' }))
})

test('postSync sends Bearer token and returns cursors+changes', async () => {
  const f = mockFetch(200, { cursors: { c1: 3 }, changes: [], children: [] })
  vi.stubGlobal('fetch', f)
  const res = await postSync('jwt.x', { cursors: { c1: 0 }, changes: [] })
  expect(res.cursors.c1).toBe(3)
  const [, init] = f.mock.calls[0]
  expect((init as unknown as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jwt.x' })
})

test('401 throws AuthError', async () => {
  vi.stubGlobal('fetch', mockFetch(401, { message: 'Invalid JWT' }))
  await expect(postSync('bad', { cursors: {}, changes: [] })).rejects.toBeInstanceOf(AuthError)
})

test('500 throws ApiError with status', async () => {
  vi.stubGlobal('fetch', mockFetch(500, { error: 'boom' }))
  await expect(register('a@b.de', 'x')).rejects.toMatchObject({ status: 500 })
  await expect(register('a@b.de', 'x')).rejects.toBeInstanceOf(ApiError)
})

// --- new tests (B2) ---

test('login returns token and userId', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ token: 't1', userId: 'u1' }),
  })
  vi.stubGlobal('fetch', fetchMock)
  const res = await login('a@b.c', 'pw')
  expect(res).toEqual({ token: 't1', userId: 'u1' })
  vi.unstubAllGlobals()
})

test('postSync sends cursors and returns children', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ cursors: { c1: 3 }, changes: [], children: [] }),
  })
  vi.stubGlobal('fetch', fetchMock)
  const res = await postSync('t1', { cursors: { c1: 0 }, changes: [] })
  expect(res.cursors.c1).toBe(3)
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body.cursors).toEqual({ c1: 0 })
  vi.unstubAllGlobals()
})
