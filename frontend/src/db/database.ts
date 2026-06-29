import Dexie, { type Table } from 'dexie'
import type { LogRecord } from '../types'

interface MetaRow { key: string; value: unknown }

export class AppDB extends Dexie {
  logs!: Table<LogRecord, string>
  meta!: Table<MetaRow, string>

  constructor(name: string) {
    super(name)
    // dirty als 0/1 (Booleans sind in IndexedDB nicht indexierbar).
    this.version(1).stores({
      logs: 'id, type, occurredAt, dirty',
      meta: '&key',
    })
  }
}

export function createDb(name = 'babytracker'): AppDB {
  return new AppDB(name)
}

/** Singleton für die App (Tests nutzen createDb mit eigenem Namen). */
export const db = createDb()

export async function getMeta<T>(database: AppDB, key: string): Promise<T | undefined> {
  const row = await database.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(database: AppDB, key: string, value: unknown): Promise<void> {
  await database.meta.put({ key, value })
}
