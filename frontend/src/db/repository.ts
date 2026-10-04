import type { AppDB } from './database'
import type { LogRecord, NewLogInput } from '../types'
import { nowIso } from '../time'

export async function addLog(db: AppDB, childId: string, createdByUserId: string | null, input: NewLogInput): Promise<LogRecord> {
  const now = nowIso()
  const base = {
    id: crypto.randomUUID(),
    childId,
    createdByUserId,
    occurredAt: input.occurredAt,
    updatedAt: now,
    deletedAt: null as string | null,
    serverSeq: null as number | null,
    dirty: 1 as const,
    note: ('note' in input ? input.note : null) ?? null,
  }
  let rec: LogRecord
  switch (input.type) {
    case 'nursing':
      rec = { ...base, type: 'nursing', side: input.side, durationMinutes: input.durationMinutes ?? null }
      break
    case 'pumping':
      rec = { ...base, type: 'pumping', amountMl: input.amountMl, side: input.side ?? null, storageLocation: input.storageLocation ?? null }
      break
    case 'bottle':
      rec = { ...base, type: 'bottle', amountMl: input.amountMl, milkType: 'breastmilk' }
      break
    case 'weight':
      rec = { ...base, type: 'weight', weightGrams: input.weightGrams }
      break
    case 'height':
      rec = { ...base, type: 'height', heightCm: input.heightCm }
      break
  }
  await db.logs.put(rec)
  return rec
}

export async function updateLog(db: AppDB, id: string, patch: Partial<LogRecord>): Promise<void> {
  await db.logs.update(id, { ...patch, updatedAt: nowIso(), dirty: 1 })
}

export async function softDeleteLog(db: AppDB, id: string): Promise<void> {
  const now = nowIso()
  await db.logs.update(id, { deletedAt: now, updatedAt: now, dirty: 1 })
}

export async function getLogsByDay(db: AppDB, childId: string, dayStartIso: string, dayEndIso: string): Promise<LogRecord[]> {
  const start = Date.parse(dayStartIso)
  const end = Date.parse(dayEndIso)
  const rows = await db.logs
    .filter((r) => r.childId === childId && r.deletedAt === null && Date.parse(r.occurredAt) >= start && Date.parse(r.occurredAt) < end)
    .toArray()
  return rows.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
}

export async function getWeightSeries(db: AppDB, childId: string): Promise<LogRecord[]> {
  return getMeasurementSeries(db, childId, 'weight')
}

export async function getHeightSeries(db: AppDB, childId: string): Promise<LogRecord[]> {
  return getMeasurementSeries(db, childId, 'height')
}

async function getMeasurementSeries(db: AppDB, childId: string, type: 'weight' | 'height'): Promise<LogRecord[]> {
  const rows = await db.logs
    .where('type').equals(type)
    .filter((r) => r.childId === childId && r.deletedAt === null)
    .toArray()
  return rows.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
}

/** Non-deleted logs with occurredAt >= sinceIso, ascending by occurredAt (for statistics). */
export async function getLogsSince(db: AppDB, childId: string, sinceIso: string): Promise<LogRecord[]> {
  const since = Date.parse(sinceIso)
  const rows = await db.logs
    .filter((r) => r.childId === childId && r.deletedAt === null && Date.parse(r.occurredAt) >= since)
    .toArray()
  return rows.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
}
