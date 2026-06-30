import type { AppDB } from '../db/database'
import { getMeta, setMeta } from '../db/database'
import type { LogRecord, ServerChange, SyncResponse } from '../types'
import { isAfter } from '../time'

export type PostSyncFn = (
  token: string,
  body: { cursors: Record<string, number>; changes: unknown[] },
) => Promise<SyncResponse>

function toPayload(rec: LogRecord): Record<string, unknown> {
  const { dirty: _dirty, createdByUserId, ...rest } = rec
  return { ...rest, createdById: createdByUserId }
}

async function mergeIncoming(db: AppDB, inc: ServerChange): Promise<void> {
  const local = await db.logs.get(inc.id)
  if (local && local.dirty === 1 && isAfter(local.updatedAt, inc.updatedAt)) {
    return
  }
  const { createdById, ...fields } = inc
  await db.logs.put({ ...(fields as Omit<ServerChange, 'createdById'>), createdByUserId: createdById, dirty: 0 })
}

export async function runSync(
  db: AppDB,
  postSync: PostSyncFn,
): Promise<{
  skipped?: 'no-token'
  pushed: number
  pulled: number
  childrenChanged: boolean
  cursors: Record<string, number>
}> {
  const token = await getMeta<string>(db, 'token')
  const cursors = (await getMeta<Record<string, number>>(db, 'cursors')) ?? {}
  if (!token) return { skipped: 'no-token', pushed: 0, pulled: 0, childrenChanged: false, cursors }

  const dirty = await db.logs.where('dirty').equals(1).toArray()
  const changes = dirty.map(toPayload)

  const resp = await postSync(token, { cursors, changes }) // wirft AuthError bei 401

  let childrenChanged = false
  await db.transaction('rw', db.logs, db.children, db.meta, async () => {
    for (const inc of resp.changes) await mergeIncoming(db, inc)
    for (const child of resp.children) {
      const existing = await db.children.get(child.id)
      if (!existing || JSON.stringify(existing) !== JSON.stringify(child)) childrenChanged = true
      await db.children.put(child)
    }
    await setMeta(db, 'cursors', resp.cursors)
  })

  return { pushed: changes.length, pulled: resp.changes.length, childrenChanged, cursors: resp.cursors }
}
