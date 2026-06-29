import type { AppDB } from '../db/database'
import { getMeta, setMeta } from '../db/database'
import type { LogRecord, ServerChange, SyncResponse } from '../types'
import { isAfter } from '../time'

export type PostSyncFn = (
  token: string,
  body: { since: number; changes: unknown[] },
) => Promise<SyncResponse>

/** Wandelt ein lokales Record in die ans Backend gesendete Change-Form (ohne lokale Flags). */
function toPayload(rec: LogRecord): Record<string, unknown> {
  const { dirty: _dirty, ...rest } = rec
  return rest
}

/** Übernimmt ein Server-Change in die DB (Incoming gewinnt, außer lokal-dirty-und-neuer). */
async function mergeIncoming(db: AppDB, inc: ServerChange): Promise<void> {
  const local = await db.logs.get(inc.id)
  if (local && local.dirty === 1 && isAfter(local.updatedAt, inc.updatedAt)) {
    return // lokale, noch nicht gepushte Änderung ist neuer → behalten
  }
  const { userId: _userId, ...fields } = inc
  await db.logs.put({ ...(fields as Omit<ServerChange, 'userId'>), dirty: 0 })
}

export async function runSync(
  db: AppDB,
  postSync: PostSyncFn,
): Promise<{ skipped?: 'no-token'; pushed: number; pulled: number; cursor: number }> {
  const token = await getMeta<string>(db, 'token')
  const since = (await getMeta<number>(db, 'cursor')) ?? 0
  if (!token) return { skipped: 'no-token', pushed: 0, pulled: 0, cursor: since }

  const dirty = await db.logs.where('dirty').equals(1).toArray()
  const changes = dirty.map(toPayload)

  const resp = await postSync(token, { since, changes }) // wirft AuthError bei 401

  await db.transaction('rw', db.logs, db.meta, async () => {
    for (const inc of resp.changes) await mergeIncoming(db, inc)
    await setMeta(db, 'cursor', resp.cursor)
  })

  return { pushed: changes.length, pulled: resp.changes.length, cursor: resp.cursor }
}
