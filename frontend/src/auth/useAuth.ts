import { useEffect, useState } from 'react'
import { db, getMeta, setMeta } from '../db/database'
import { login as apiLogin, register as apiRegister } from '../api/client'
import { syncController } from '../sync/syncController'

export function useAuth() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void getMeta<string>(db, 'token').then((t) => {
      setToken(t || null)
      setReady(true)
    })
  }, [])

  async function persist(t: string) {
    await setMeta(db, 'token', t)
    setToken(t)
    void syncController.requestSync()
  }

  return {
    token,
    ready,
    async signIn(email: string, password: string) {
      const { token: t } = await apiLogin(email, password)
      await persist(t)
    },
    async signUp(email: string, password: string) {
      await apiRegister(email, password)
      const { token: t } = await apiLogin(email, password)
      await persist(t)
    },
    async signOut() {
      await setMeta(db, 'token', '')
      setToken(null)
    },
  }
}
