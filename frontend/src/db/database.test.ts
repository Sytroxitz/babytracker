import { beforeEach, expect, test } from 'vitest'
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
