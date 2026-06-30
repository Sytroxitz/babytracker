import { expect, test, vi } from 'vitest'
import { createDb, getMeta, setMeta } from '../db/database'
import { runSync, type PostSyncFn } from './syncEngine'
import type { SyncResponse, ServerChange } from '../types'
import { AuthError } from '../api/client'

function makeResp(over: Partial<SyncResponse> = {}): SyncResponse {
  return { cursors: {}, changes: [], children: [], ...over }
}

function serverChange(over: Partial<ServerChange> & Pick<ServerChange, 'id' | 'type' | 'serverSeq'>): ServerChange {
  return {
    childId: 'c1',
    createdById: 'u1',
    occurredAt: '2026-06-01T09:00:00+00:00',
    updatedAt: '2026-06-01T09:00:00+00:00',
    deletedAt: null,
    note: null,
    ...over,
  } as ServerChange
}

// ── Brief core test (verbatim) ───────────────────────────────────────────────
test('stores per-child cursors and children, maps createdById', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  await setMeta(db, 'token', 't1')
  await db.logs.put({ id: 'l1', type: 'nursing', childId: 'c1', createdByUserId: 'u1', occurredAt: '2026-02-01T10:00:00Z', updatedAt: '2026-02-01T10:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, side: 'left' })

  const postSync = vi.fn().mockResolvedValue({
    cursors: { c1: 7 },
    children: [{ id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: null, createdAt: '2026-01-01T00:00:00Z', deletedAt: null, members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }] }],
    changes: [{ id: 'l2', type: 'bottle', childId: 'c1', createdById: 'u2', occurredAt: '2026-02-01T12:00:00Z', updatedAt: '2026-02-01T12:00:00Z', deletedAt: null, serverSeq: 7, amountMl: 90 }],
  })

  const res = await runSync(db, postSync)

  const sent = postSync.mock.calls[0][1]
  expect(sent.cursors).toEqual({}) // initial leer
  expect(sent.changes[0].childId).toBe('c1')
  expect(res.pulled).toBe(1)

  const merged = await db.logs.get('l2')
  expect(merged?.createdByUserId).toBe('u2')
  expect(await getMeta(db, 'cursors')).toEqual({ c1: 7 })
  expect((await db.children.get('c1'))?.name).toBe('Mia')
  await db.delete()
})

// ── Supporting tests (updated for cursors-map API) ───────────────────────────

test('no token: skips, no network call', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  const post: PostSyncFn = vi.fn()
  const res = await runSync(db, post)
  expect(res.skipped).toBe('no-token')
  expect(post).not.toHaveBeenCalled()
  await db.delete()
})

test('no-token returns the full documented shape', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  const post: PostSyncFn = vi.fn()
  const res = await runSync(db, post)
  expect(res.skipped).toBe('no-token')
  expect(res.pushed).toBe(0)
  expect(res.pulled).toBe(0)
  expect(res.cursors).toEqual({})
  expect(post).not.toHaveBeenCalled()
  await db.delete()
})

test('pushes dirty logs and clears their dirty flag on echo', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  await setMeta(db, 'token', 'jwt.x')
  await db.logs.put({ id: 'log1', type: 'pumping', childId: 'c1', createdByUserId: 'u1', occurredAt: '2026-06-01T09:00:00Z', updatedAt: '2026-06-01T09:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, amountMl: 120 })
  const post: PostSyncFn = vi.fn(async (_t, body) => {
    expect(body.cursors).toEqual({})
    expect(body.changes).toHaveLength(1)
    return makeResp({ cursors: { c1: 1 }, changes: [serverChange({ id: 'log1', type: 'pumping', amountMl: 120, serverSeq: 1, updatedAt: '2026-06-01T09:00:00Z' })] })
  })
  const res = await runSync(db, post)
  expect(res.pushed).toBe(1)
  expect(res.pulled).toBe(1)
  const after = await db.logs.get('log1')
  expect(after!.dirty).toBe(0)
  expect(after!.serverSeq).toBe(1)
  expect(await getMeta(db, 'cursors')).toEqual({ c1: 1 })
  await db.delete()
})

test('pull inserts an unknown remote record as clean', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  await setMeta(db, 'token', 'jwt.x')
  const post: PostSyncFn = vi.fn(async () =>
    makeResp({ cursors: { c1: 7 }, changes: [serverChange({ id: 'remote-1', type: 'weight', weightGrams: 4300, serverSeq: 7 })] }),
  )
  await runSync(db, post)
  const rec = await db.logs.get('remote-1')
  expect(rec!.weightGrams).toBe(4300)
  expect(rec!.dirty).toBe(0)
  expect(rec!.serverSeq).toBe(7)
  await db.delete()
})

test('local dirty newer than incoming is kept (stays dirty)', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  await setMeta(db, 'token', 'jwt.x')
  await db.logs.put({ id: 'log2', type: 'weight', childId: 'c1', createdByUserId: 'u1', occurredAt: '2026-06-01T09:00:00Z', updatedAt: '2026-06-01T09:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, weightGrams: 5000 })
  const post: PostSyncFn = vi.fn(async () =>
    makeResp({ cursors: { c1: 3 }, changes: [serverChange({ id: 'log2', type: 'weight', weightGrams: 4000, serverSeq: 3, updatedAt: '2020-01-01T00:00:00+00:00' })] }),
  )
  await runSync(db, post)
  const after = await db.logs.get('log2')
  expect(after!.weightGrams).toBe(5000)
  expect(after!.dirty).toBe(1)
  await db.delete()
})

test('incoming soft-delete is applied', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  await setMeta(db, 'token', 'jwt.x')
  await db.logs.put({ id: 'x', type: 'nursing', childId: 'c1', createdByUserId: 'u1', occurredAt: '2026-06-01T09:00:00Z', updatedAt: '2026-06-01T09:00:00Z', deletedAt: null, serverSeq: 1, dirty: 0, side: 'left' })
  const post: PostSyncFn = vi.fn(async () =>
    makeResp({ cursors: { c1: 9 }, changes: [serverChange({ id: 'x', type: 'nursing', side: 'left', serverSeq: 9, updatedAt: '2026-06-02T09:00:00+00:00', deletedAt: '2026-06-02T09:00:00+00:00' })] }),
  )
  await runSync(db, post)
  const after = await db.logs.get('x')
  expect(after!.deletedAt).not.toBeNull()
  await db.delete()
})

test('AuthError propagates out of runSync', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  await setMeta(db, 'token', 'jwt.x')
  const post: PostSyncFn = vi.fn(async () => { throw new AuthError() })
  await expect(runSync(db, post)).rejects.toBeInstanceOf(AuthError)
  await db.delete()
})

test('when local dirty wins (LWW keep-local), cursors still advance', async () => {
  const db = createDb('test-sync-' + crypto.randomUUID())
  await setMeta(db, 'token', 'jwt.x')
  await db.logs.put({ id: 'log3', type: 'weight', childId: 'c1', createdByUserId: 'u1', occurredAt: '2026-06-01T09:00:00Z', updatedAt: '2026-06-01T09:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, weightGrams: 5000 })
  const post: PostSyncFn = vi.fn(async () =>
    makeResp({ cursors: { c1: 3 }, changes: [serverChange({ id: 'log3', type: 'weight', weightGrams: 4000, serverSeq: 3, updatedAt: '2020-01-01T00:00:00+00:00' })] }),
  )
  await runSync(db, post)
  expect((await db.logs.get('log3'))!.weightGrams).toBe(5000)
  expect(await getMeta(db, 'cursors')).toEqual({ c1: 3 })
  await db.delete()
})
