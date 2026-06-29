import { useState } from 'react'
import { Button } from './components/Button'

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}

export function AuthScreen({ onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await (mode === 'in' ? onSignIn : onSignUp)(email, password)
    } catch {
      setError(mode === 'in' ? 'Anmeldung fehlgeschlagen.' : 'Registrierung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-full grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-center">BabyTracker</h1>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-400">E-Mail</span>
          <input type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 rounded-xl bg-neutral-900 px-4 text-lg" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-400">Passwort</span>
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 rounded-xl bg-neutral-900 px-4 text-lg" />
        </label>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <Button type="submit" disabled={busy}>{mode === 'in' ? 'Anmelden' : 'Registrieren'}</Button>
        <button type="button" className="text-sm text-neutral-400 underline"
          onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
        </button>
      </form>
    </main>
  )
}
