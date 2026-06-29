import { beforeEach, expect, test, vi } from 'vitest'
import { createDb, getMeta, setMeta, type AppDB } from '../db/database'
import { addLog } from '../db/repository'
import { runSync, type PostSyncFn } from './syncEngine'
import type { ServerChange } from '../types'

let db: AppDB
beforeEach(async () => {
  db = createDb('test-' + crypto.randomUUID())
  await db.open()
})

function serverChange(over: Partial<ServerChange> & Pick<ServerChange, 'id' | 'type' | 'serverSeq'>): ServerChange {
  return {
    userId: 'u1',
    occurredAt: '2026-06-01T09:00:00+00:00',
    updatedAt: '2026-06-01T09:00:00+00:00',
    deletedAt: null,
    note: null,
    ...over,
  } as ServerChange
}

test('no token: skips, no network call', async () => {
  const post: PostSyncFn = vi.fn()
  const res = await runSync(db, post)
  expect(res.skipped).toBe('no-token')
  expect(post).not.toHaveBeenCalled()
})

test('pushes dirty logs and clears their dirty flag on echo', async () => {
  await setMeta(db, 'token', 'jwt.x')
  const rec = await addLog(db, { type: 'pumping', occurredAt: '2026-06-01T09:00:00Z', amountMl: 120 })
  const post: PostSyncFn = vi.fn(async (_t, body) => {
    expect(body.since).toBe(0)
    expect(body.changes).toHaveLength(1)
    // Server echoes the pushed record back with a serverSeq + DATE_ATOM timestamp
    return { cursor: 1, changes: [serverChange({ id: rec.id, type: 'pumping', amountMl: 120, serverSeq: 1, updatedAt: rec.updatedAt })] }
  })
  const res = await runSync(db, post)
  expect(res.pushed).toBe(1)
  expect(res.pulled).toBe(1)
  const after = await db.logs.get(rec.id)
  expect(after!.dirty).toBe(0)
  expect(after!.serverSeq).toBe(1)
  expect(await getMeta<number>(db, 'cursor')).toBe(1)
})

test('pull inserts an unknown remote record as clean', async () => {
  await setMeta(db, 'token', 'jwt.x')
  const post: PostSyncFn = vi.fn(async () => ({
    cursor: 7,
    changes: [serverChange({ id: 'remote-1', type: 'weight', weightGrams: 4300, serverSeq: 7 })],
  }))
  await runSync(db, post)
  const rec = await db.logs.get('remote-1')
  expect(rec!.weightGrams).toBe(4300)
  expect(rec!.dirty).toBe(0)
  expect(rec!.serverSeq).toBe(7)
})

test('local dirty newer than incoming is kept (stays dirty)', async () => {
  await setMeta(db, 'token', 'jwt.x')
  const rec = await addLog(db, { type: 'weight', occurredAt: '2026-06-01T09:00:00Z', weightGrams: 5000 }) // updatedAt = now (newest)
  const post: PostSyncFn = vi.fn(async () => ({
    cursor: 3,
    changes: [serverChange({ id: rec.id, type: 'weight', weightGrams: 4000, serverSeq: 3, updatedAt: '2020-01-01T00:00:00+00:00' })],
  }))
  await runSync(db, post)
  const after = await db.logs.get(rec.id)
  expect(after!.weightGrams).toBe(5000) // local kept
  expect(after!.dirty).toBe(1)
})

test('incoming soft-delete is applied', async () => {
  await setMeta(db, 'token', 'jwt.x')
  await db.logs.put({ id: 'x', type: 'nursing', occurredAt: '2026-06-01T09:00:00Z', updatedAt: '2026-06-01T09:00:00Z', deletedAt: null, serverSeq: 1, dirty: 0, side: 'left' })
  const post: PostSyncFn = vi.fn(async () => ({
    cursor: 9,
    changes: [serverChange({ id: 'x', type: 'nursing', side: 'left', serverSeq: 9, updatedAt: '2026-06-02T09:00:00+00:00', deletedAt: '2026-06-02T09:00:00+00:00' })],
  }))
  await runSync(db, post)
  const after = await db.logs.get('x')
  expect(after!.deletedAt).not.toBeNull()
})
