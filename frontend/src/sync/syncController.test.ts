import { beforeEach, expect, test, vi } from 'vitest'
import { createDb, setMeta, type AppDB } from '../db/database'
import { addLog } from '../db/repository'
import { SyncController } from './syncController'
import { AuthError } from '../api/client'
import type { PostSyncFn } from './syncEngine'

let db: AppDB
beforeEach(async () => {
  db = createDb('test-' + crypto.randomUUID())
  await db.open()
})

test('requestSync swallows network errors (offline is expected)', async () => {
  await setMeta(db, 'token', 'jwt.x')
  await addLog(db, 'c1', null, { type: 'weight', occurredAt: '2026-06-01T09:00:00Z', weightGrams: 4000 })
  const post: PostSyncFn = vi.fn(async () => { throw new TypeError('Failed to fetch') })
  const sc = new SyncController(db, post)
  await sc.requestSync()
  expect(post).toHaveBeenCalled()
  expect(sc.needsRelogin).toBe(false) // kein User-Error
})

test('AuthError sets needsRelogin', async () => {
  await setMeta(db, 'token', 'jwt.x')
  await addLog(db, 'c1', null, { type: 'weight', occurredAt: '2026-06-01T09:00:00Z', weightGrams: 4000 })
  const post: PostSyncFn = vi.fn(async () => { throw new AuthError() })
  const sc = new SyncController(db, post)
  const seen: boolean[] = []
  sc.onChange(() => seen.push(sc.needsRelogin))
  await sc.requestSync()
  expect(sc.needsRelogin).toBe(true)
  expect(seen).toContain(true)
})

test('successful sync clears needsRelogin', async () => {
  await setMeta(db, 'token', 'jwt.x')
  const post: PostSyncFn = vi.fn(async () => ({ cursors: {}, changes: [], children: [] }))
  const sc = new SyncController(db, post)
  ;(sc as unknown as { needsRelogin: boolean }).needsRelogin = true
  await sc.requestSync()
  expect(sc.needsRelogin).toBe(false)
})
