import { beforeEach, expect, test } from 'vitest'
import { createDb, type AppDB } from './database'
import { addLog, updateLog, softDeleteLog, getLogsByDay, getWeightSeries, getLogsSince } from './repository'

let db: AppDB
beforeEach(async () => {
  db = createDb('test-' + crypto.randomUUID())
  await db.open()
})

test('addLog creates a dirty, client-id record; bottle forces milkType', async () => {
  const rec = await addLog(db, 'child1', null, { type: 'bottle', occurredAt: '2026-06-01T09:00:00Z', amountMl: 90 })
  expect(rec.id).toMatch(/[0-9a-f-]{36}/)
  expect(rec.dirty).toBe(1)
  expect(rec.serverSeq).toBeNull()
  expect(rec.deletedAt).toBeNull()
  expect(rec.milkType).toBe('breastmilk')
  expect(await db.logs.count()).toBe(1)
})

test('updateLog bumps updatedAt and re-dirties', async () => {
  const rec = await addLog(db, 'child1', null, { type: 'weight', occurredAt: '2026-06-01T09:00:00Z', weightGrams: 4000 })
  await db.logs.update(rec.id, { dirty: 0 })
  await updateLog(db, rec.id, { weightGrams: 4200 })
  const after = await db.logs.get(rec.id)
  expect(after!.weightGrams).toBe(4200)
  expect(after!.dirty).toBe(1)
  expect(Date.parse(after!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(rec.updatedAt))
})

test('softDeleteLog sets deletedAt and excludes from day query', async () => {
  const rec = await addLog(db, 'child1', null, { type: 'nursing', occurredAt: '2026-06-01T09:00:00Z', side: 'left' })
  await softDeleteLog(db, rec.id)
  const after = await db.logs.get(rec.id)
  expect(after!.deletedAt).not.toBeNull()
  expect(after!.dirty).toBe(1)
  const day = await getLogsByDay(db, 'child1', '2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z')
  expect(day).toHaveLength(0)
})

test('getLogsByDay returns non-deleted in-range, newest first', async () => {
  await addLog(db, 'child1', null, { type: 'nursing', occurredAt: '2026-06-01T08:00:00Z', side: 'left' })
  await addLog(db, 'child1', null, { type: 'pumping', occurredAt: '2026-06-01T20:00:00Z', amountMl: 120 })
  await addLog(db, 'child1', null, { type: 'weight', occurredAt: '2026-06-02T08:00:00Z', weightGrams: 4100 })
  const day = await getLogsByDay(db, 'child1', '2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z')
  expect(day.map((r) => r.type)).toEqual(['pumping', 'nursing'])
})

test('getWeightSeries returns weights ascending', async () => {
  await addLog(db, 'child1', null, { type: 'weight', occurredAt: '2026-06-02T08:00:00Z', weightGrams: 4100 })
  await addLog(db, 'child1', null, { type: 'weight', occurredAt: '2026-06-01T08:00:00Z', weightGrams: 4000 })
  await addLog(db, 'child1', null, { type: 'nursing', occurredAt: '2026-06-01T09:00:00Z', side: 'left' })
  const series = await getWeightSeries(db, 'child1')
  expect(series.map((r) => r.weightGrams)).toEqual([4000, 4100])
})

test('addLog stamps childId + creator; getLogsByDay filters by child', async () => {
  const db = createDb('test-repo-' + crypto.randomUUID())
  await addLog(db, 'c1', 'u1', { type: 'nursing', occurredAt: '2026-02-01T10:00:00Z', side: 'left' })
  await addLog(db, 'c2', 'u1', { type: 'nursing', occurredAt: '2026-02-01T11:00:00Z', side: 'right' })

  const day = await getLogsByDay(db, 'c1', '2026-02-01T00:00:00Z', '2026-02-02T00:00:00Z')
  expect(day).toHaveLength(1)
  expect(day[0].childId).toBe('c1')
  expect(day[0].createdByUserId).toBe('u1')
  await db.delete()
})
