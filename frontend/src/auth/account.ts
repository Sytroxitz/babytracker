import type { AppDB } from '../db/database'
import { getMeta, setMeta } from '../db/database'

/** Guards against cross-account data bleed on a shared device. If a DIFFERENT
 *  account was previously used here, clears local logs + resets the sync cursor
 *  before the next sync. First login or same-account re-login keeps local data. */
export async function reconcileAccount(db: AppDB, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  const prev = await getMeta<string>(db, 'accountId')
  if (prev && prev !== normalized) {
    await db.logs.clear()
    await setMeta(db, 'cursor', 0)
  }
  await setMeta(db, 'accountId', normalized)
}
