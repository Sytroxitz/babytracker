import type { AppDB } from './database'
import type { LogRecord, NewLogInput } from '../types'
import { nowIso } from '../time'

export async function addLog(db: AppDB, input: NewLogInput): Promise<LogRecord> {
  const now = nowIso()
  const base = {
    id: crypto.randomUUID(),
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

export async function getLogsByDay(db: AppDB, dayStartIso: string, dayEndIso: string): Promise<LogRecord[]> {
  const start = Date.parse(dayStartIso)
  const end = Date.parse(dayEndIso)
  const rows = await db.logs
    .filter((r) => r.deletedAt === null && Date.parse(r.occurredAt) >= start && Date.parse(r.occurredAt) < end)
    .toArray()
  return rows.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
}

export async function getWeightSeries(db: AppDB): Promise<LogRecord[]> {
  const rows = await db.logs.where('type').equals('weight').filter((r) => r.deletedAt === null).toArray()
  return rows.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
}
