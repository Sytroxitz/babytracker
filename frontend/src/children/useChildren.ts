import { useCallback, useEffect, useState } from 'react'
import { db as defaultDb, getMeta, setMeta, type AppDB } from '../db/database'
import type { Child, Role } from '../types'

export function roleOf(child: Child | null, userId: string | null): Role | null {
  if (!child || !userId) return null
  return child.members.find((m) => m.userId === userId)?.role ?? null
}

export function makeUseChildren(db: AppDB) {
  return function useChildren() {
    const [children, setChildren] = useState<Child[]>([])
    const [activeChildId, setActiveId] = useState<string | null>(null)
    const [myUserId, setMyUserId] = useState<string | null>(null)
    const [ready, setReady] = useState(false)

    const refresh = useCallback(async () => {
      const all = (await db.children.toArray()).filter((c) => c.deletedAt === null)
      setChildren(all)
      const stored = await getMeta<string>(db, 'activeChildId')
      const valid = all.find((c) => c.id === stored) ? stored! : (all[0]?.id ?? null)
      if (valid !== stored) {
        if (valid) await setMeta(db, 'activeChildId', valid)
      }
      setActiveId(valid)
      setMyUserId((await getMeta<string>(db, 'myUserId')) ?? null)
      setReady(true)
    }, [])

    useEffect(() => { void refresh() }, [refresh])

    const setActiveChild = useCallback(async (id: string) => {
      await setMeta(db, 'activeChildId', id)
      setActiveId(id)
    }, [])

    const activeChild = children.find((c) => c.id === activeChildId) ?? null
    return { children, activeChild, activeChildId, myUserId, ready, setActiveChild, refresh }
  }
}

export const useChildren = makeUseChildren(defaultDb)
