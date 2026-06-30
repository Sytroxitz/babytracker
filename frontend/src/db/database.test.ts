import { beforeEach, expect, test } from 'vitest'
import Dexie from 'dexie'
import { createDb, getMeta, setMeta, type AppDB } from './database'

let db: AppDB
beforeEach(async () => {
  db = createDb('test-' + crypto.randomUUID())
  await db.open()
})

test('meta round-trips typed values', async () => {
  expect(await getMeta<number>(db, 'cursor')).toBeUndefined()
  await setMeta(db, 'cursor', 42)
  await setMeta(db, 'token', 'jwt.abc')
  expect(await getMeta<number>(db, 'cursor')).toBe(42)
  expect(await getMeta<string>(db, 'token')).toBe('jwt.abc')
})

test('logs table indexes dirty and occurredAt', async () => {
  await db.logs.bulkPut([
    { id: 'a', type: 'weight', occurredAt: '2026-06-01T10:00:00Z', updatedAt: '2026-06-01T10:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, weightGrams: 4000 },
    { id: 'b', type: 'weight', occurredAt: '2026-06-02T10:00:00Z', updatedAt: '2026-06-02T10:00:00Z', deletedAt: null, serverSeq: 5, dirty: 0, weightGrams: 4100 },
  ])
  const dirty = await db.logs.where('dirty').equals(1).toArray()
  expect(dirty.map((r) => r.id)).toEqual(['a'])
})

test('children table exists and stores a child', async () => {
  const db = createDb('test-children-' + crypto.randomUUID())
  await db.children.put({
    id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01',
    birthWeightGrams: 3200, createdAt: new Date().toISOString(), deletedAt: null,
    members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }],
  })
  const got = await db.children.get('c1')
  expect(got?.name).toBe('Mia')
  expect(got?.members[0].role).toBe('mama')
  await db.delete()
})

test('logs can be queried by [childId+occurredAt]', async () => {
  const db = createDb('test-childidx-' + crypto.randomUUID())
  await db.logs.bulkPut([
    { id: 'l1', type: 'nursing', childId: 'c1', createdByUserId: 'u1', occurredAt: '2026-02-01T10:00:00Z', updatedAt: '2026-02-01T10:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, side: 'left' },
    { id: 'l2', type: 'nursing', childId: 'c2', createdByUserId: 'u1', occurredAt: '2026-02-01T11:00:00Z', updatedAt: '2026-02-01T11:00:00Z', deletedAt: null, serverSeq: null, dirty: 1, side: 'right' },
  ])
  const c1 = await db.logs.where('[childId+occurredAt]')
    .between(['c1', Dexie.minKey], ['c1', Dexie.maxKey]).toArray()
  expect(c1.map((r) => r.id)).toEqual(['l1'])
  await db.delete()
})
