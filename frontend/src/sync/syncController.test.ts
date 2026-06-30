import { beforeEach, expect, test, vi } from 'vitest'
import { createDb, setMeta, type AppDB } from '../db/database'
import { addLog } from '../db/repository'
import { SyncController } from './syncController'
import { AuthError } from '../api/client'
import type { PostSyncFn } from './syncEngine'
import type { ServerChange } from '../types'

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

test('notifies onSynced listeners when the pull brought changes (partner updates appear live)', async () => {
  await setMeta(db, 'token', 'jwt.x')
  const change: ServerChange = {
    id: crypto.randomUUID(), childId: 'c1', createdById: null, createdByUserId: null, type: 'weight',
    occurredAt: '2026-06-01T09:00:00Z', updatedAt: '2026-06-01T09:00:00Z',
    deletedAt: null, serverSeq: 1, weightGrams: 4000,
  }
  const post: PostSyncFn = vi.fn(async () => ({ cursors: { c1: 1 }, changes: [change], children: [] }))
  const sc = new SyncController(db, post)
  let notified = 0
  sc.onSynced(() => { notified++ })
  await sc.requestSync()
  expect(notified).toBe(1)
})

test('does not notify onSynced when nothing was pulled', async () => {
  await setMeta(db, 'token', 'jwt.x')
  const post: PostSyncFn = vi.fn(async () => ({ cursors: {}, changes: [], children: [] }))
  const sc = new SyncController(db, post)
  let notified = 0
  sc.onSynced(() => { notified++ })
  await sc.requestSync()
  expect(notified).toBe(0)
})

test('notifies onSynced when only child master data changed (partner edited the child)', async () => {
  await setMeta(db, 'token', 'jwt.x')
  const child = {
    id: 'c1', name: 'Rose', gender: 'female' as const, birthDate: '2026-01-01',
    birthWeightGrams: 3200, createdAt: 'x', deletedAt: null, members: [],
  }
  const post: PostSyncFn = vi.fn(async () => ({ cursors: {}, changes: [], children: [child] }))
  const sc = new SyncController(db, post)
  let notified = 0
  sc.onSynced(() => { notified++ })
  await sc.requestSync()
  expect(notified).toBe(1)
})
