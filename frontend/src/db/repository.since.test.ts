import { beforeEach, expect, test } from 'vitest'
import { createDb, type AppDB } from './database'
import { addLog, softDeleteLog, getLogsSince } from './repository'

let db: AppDB
beforeEach(async () => {
  db = createDb('test-' + crypto.randomUUID())
  await db.open()
})

test('getLogsSince returns non-deleted logs from the cutoff, ascending', async () => {
  await addLog(db, { type: 'bottle', occurredAt: '2026-06-01T08:00:00Z', amountMl: 90 })
  await addLog(db, { type: 'nursing', occurredAt: '2026-06-10T08:00:00Z', side: 'left' })
  const recent = await addLog(db, { type: 'bottle', occurredAt: '2026-06-12T08:00:00Z', amountMl: 100 })
  await softDeleteLog(db, recent.id)

  const rows = await getLogsSince(db, '2026-06-05T00:00:00Z')
  // 06-01 is before cutoff; the 06-12 bottle is soft-deleted → only the nursing remains
  expect(rows.map((r) => r.type)).toEqual(['nursing'])
})

test('getLogsSince sorts ascending by occurredAt', async () => {
  await addLog(db, { type: 'bottle', occurredAt: '2026-06-10T20:00:00Z', amountMl: 100 })
  await addLog(db, { type: 'bottle', occurredAt: '2026-06-10T08:00:00Z', amountMl: 90 })
  const rows = await getLogsSince(db, '2026-06-01T00:00:00Z')
  expect(rows.map((r) => r.amountMl)).toEqual([90, 100])
})
