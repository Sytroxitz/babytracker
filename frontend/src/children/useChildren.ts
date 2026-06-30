import { useEffect, useSyncExternalStore } from 'react'
import { db as defaultDb, getMeta, setMeta, type AppDB } from '../db/database'
import type { Child, Role } from '../types'

export function roleOf(child: Child | null, userId: string | null): Role | null {
  if (!child || !userId) return null
  return child.members.find((m) => m.userId === userId)?.role ?? null
}

interface ChildrenState {
  children: Child[]
  activeChildId: string | null
  myUserId: string | null
  ready: boolean
}

export function makeUseChildren(db: AppDB) {
  // Shared store so every component that calls useChildren() (e.g. the header
  // ChildSwitcher and the App that feeds the views) observes the same active
  // child — switching in one place re-renders all of them.
  let state: ChildrenState = { children: [], activeChildId: null, myUserId: null, ready: false }
  const listeners = new Set<() => void>()

  function emit() {
    for (const l of listeners) l()
  }
  function setState(patch: Partial<ChildrenState>) {
    state = { ...state, ...patch }
    emit()
  }

  async function refresh() {
    const all = (await db.children.toArray()).filter((c) => c.deletedAt === null)
    const stored = await getMeta<string>(db, 'activeChildId')
    const valid = all.find((c) => c.id === stored) ? stored! : (all[0]?.id ?? null)
    if (valid && valid !== stored) await setMeta(db, 'activeChildId', valid)
    const myUserId = (await getMeta<string>(db, 'myUserId')) ?? null
    setState({ children: all, activeChildId: valid, myUserId, ready: true })
  }

  async function setActiveChild(id: string) {
    await setMeta(db, 'activeChildId', id)
    setState({ activeChildId: id })
  }

  function subscribe(cb: () => void) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }
  const getSnapshot = () => state

  return function useChildren() {
    const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    // Re-sync from the DB whenever a consumer mounts (keeps the store fresh
    // after login / onboarding and across test runs sharing the singleton).
    useEffect(() => {
      void refresh()
    }, [])

    const activeChild = snap.children.find((c) => c.id === snap.activeChildId) ?? null
    return { ...snap, activeChild, setActiveChild, refresh }
  }
}

export const useChildren = makeUseChildren(defaultDb)
