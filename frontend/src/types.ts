export type LogType = 'nursing' | 'pumping' | 'bottle' | 'weight'
export type Side = 'left' | 'right' | 'both'
export type StorageLocation = 'fridge' | 'freezer'
export type Gender = 'male' | 'female' | 'diverse'
export type Role = 'mama' | 'papa'

export interface ChildMember { userId: string; role: Role; email: string }
export interface Child {
  id: string
  name: string
  gender: Gender
  birthDate: string            // YYYY-MM-DD
  birthWeightGrams: number | null
  createdAt: string
  deletedAt: string | null
  members: ChildMember[]
}

/** Flaches, in Dexie gespeichertes Record. Typ-spezifische Felder sind optional. */
export interface LogRecord {
  id: string
  childId: string
  createdByUserId: string | null
  type: LogType
  occurredAt: string          // ISO-8601
  updatedAt: string           // ISO-8601 (Konfliktauflösung)
  deletedAt: string | null    // ISO-8601 | null (Soft-Delete)
  serverSeq: number | null    // vom Server vergeben; lokal-only = null
  dirty: 0 | 1                // 1 = lokal geändert, noch nicht bestätigt gepusht
  note?: string | null
  // nursing
  side?: Side | null
  durationMinutes?: number | null
  // pumping / bottle
  amountMl?: number | null
  storageLocation?: StorageLocation | null
  milkType?: string | null
  // weight
  weightGrams?: number | null
}

/** Vom Server geliefertes Change-Objekt (wie LogRecord, aber ohne lokale Flags). */
export type ServerChange = Omit<LogRecord, 'dirty'> & { createdById: string | null }

export interface SyncResponse {
  cursors: Record<string, number>
  changes: ServerChange[]
  children: Child[]
}

/** Eingaben aus den Schnell-Erfassen-Formularen (typ-diskriminiert). */
export type NewLogInput =
  | { type: 'nursing'; occurredAt: string; side: Side; durationMinutes?: number | null; note?: string | null }
  | { type: 'pumping'; occurredAt: string; amountMl: number; side?: Side | null; storageLocation?: StorageLocation | null; note?: string | null }
  | { type: 'bottle'; occurredAt: string; amountMl: number; note?: string | null }
  | { type: 'weight'; occurredAt: string; weightGrams: number; note?: string | null }
