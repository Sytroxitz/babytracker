import { beforeEach, describe, expect, test } from 'vitest'
import { createDb, getMeta, setMeta, type AppDB } from '../db/database'
import { reconcileAccount } from './account'

let db: AppDB
beforeEach(async () => {
  db = createDb('test-' + crypto.randomUUID())
  await db.open()
})

describe('reconcileAccount', () => {
  test('first login records identity, no wipe', async () => {
    // Put one log row directly and set cursor – no prior accountId
    await db.logs.put({
      id: 'x',
      type: 'weight',
      occurredAt: '2026-06-01T10:00:00Z',
      updatedAt: '2026-06-01T10:00:00Z',
      deletedAt: null,
      serverSeq: null,
      dirty: 1,
      weightGrams: 4000,
    })
    await setMeta(db, 'cursor', 5)

    await reconcileAccount(db, 'a@b.de')

    expect(await db.logs.count()).toBe(1)
    expect(await getMeta<number>(db, 'cursor')).toBe(5)
    expect(await getMeta<string>(db, 'accountId')).toBe('a@b.de')
  })

  test('same account re-login keeps data', async () => {
    await setMeta(db, 'accountId', 'a@b.de')
    await db.logs.put({
      id: 'y',
      type: 'weight',
      occurredAt: '2026-06-01T10:00:00Z',
      updatedAt: '2026-06-01T10:00:00Z',
      deletedAt: null,
      serverSeq: null,
      dirty: 1,
      weightGrams: 4100,
    })
    await setMeta(db, 'cursor', 5)

    await reconcileAccount(db, 'a@b.de')

    expect(await db.logs.count()).toBe(1)
    expect(await getMeta<number>(db, 'cursor')).toBe(5)
  })

  test('different account wipes logs + resets cursor', async () => {
    await setMeta(db, 'accountId', 'a@b.de')
    await db.logs.bulkPut([
      {
        id: 'p',
        type: 'weight',
        occurredAt: '2026-06-01T10:00:00Z',
        updatedAt: '2026-06-01T10:00:00Z',
        deletedAt: null,
        serverSeq: null,
        dirty: 1,
        weightGrams: 4000,
      },
      {
        id: 'q',
        type: 'weight',
        occurredAt: '2026-06-02T10:00:00Z',
        updatedAt: '2026-06-02T10:00:00Z',
        deletedAt: null,
        serverSeq: 3,
        dirty: 0,
        weightGrams: 4200,
      },
    ])
    await setMeta(db, 'cursor', 9)

    await reconcileAccount(db, 'b@c.de')

    expect(await db.logs.count()).toBe(0)
    expect(await getMeta<number>(db, 'cursor')).toBe(0)
    expect(await getMeta<string>(db, 'accountId')).toBe('b@c.de')
  })
})
