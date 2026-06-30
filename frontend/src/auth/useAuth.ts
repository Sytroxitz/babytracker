import { useEffect, useState } from 'react'
import { db, getMeta, setMeta } from '../db/database'
import { login as apiLogin, register as apiRegister } from '../api/client'
import { syncController } from '../sync/syncController'
import { reconcileAccount } from './account'
import { isWellFormedJwt } from './token'

export function useAuth() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void getMeta<string>(db, 'token').then((t) => {
      // A corrupted/legacy token would be rejected by the backend on every
      // call; treat it as logged-out (and clear it) so the user lands on the
      // sign-in screen instead of a half-broken session.
      if (t && isWellFormedJwt(t)) {
        setToken(t)
      } else {
        if (t) void setMeta(db, 'token', '')
        setToken(null)
      }
      setReady(true)
    })
  }, [])

  async function persist(t: string, email: string) {
    await reconcileAccount(db, email)
    await setMeta(db, 'token', t)
    setToken(t)
    void syncController.requestSync()
  }

  return {
    token,
    ready,
    async signIn(email: string, password: string) {
      const { token: t, userId } = await apiLogin(email, password)
      await setMeta(db, 'myUserId', userId)
      await persist(t, email)
    },
    async signUp(email: string, password: string) {
      await apiRegister(email, password)
      const { token: t, userId } = await apiLogin(email, password)
      await setMeta(db, 'myUserId', userId)
      await persist(t, email)
    },
    async signOut() {
      await setMeta(db, 'token', '')
      setToken(null)
    },
  }
}
