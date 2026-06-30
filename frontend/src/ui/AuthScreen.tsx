import { useState } from 'react'
import { Button } from './components/Button'
import { ApiError, AuthError } from '../api/client'

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}

type Mode = 'in' | 'up'

export function AuthScreen({ onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function pickError(err: unknown): string {
    if (err instanceof AuthError) {
      return mode === 'in'
        ? 'E-Mail oder Passwort ist falsch.'
        : 'Anmeldung nach der Registrierung fehlgeschlagen.'
    }
    if (err instanceof ApiError) {
      // Backend liefert bei doppelter E-Mail (noch) 500, nicht 409.
      return mode === 'in'
        ? 'Anmeldung fehlgeschlagen. Bitte versuch es gleich nochmal.'
        : 'Registrierung fehlgeschlagen – vielleicht gibt es diese E-Mail schon.'
    }
    return 'Keine Verbindung zum Server. Bist du online?'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await (mode === 'in' ? onSignIn : onSignUp)(email, password)
      // Erfolg: die App-Shell übernimmt (Auth-Gate wechselt) – kein weiteres UI nötig.
    } catch (err) {
      setError(pickError(err))
    } finally {
      setBusy(false)
    }
  }

  function switchMode(m: Mode) {
    if (m === mode) return
    setMode(m)
    setError(null)
  }

  const submitLabel = mode === 'in' ? 'Anmelden' : 'Konto erstellen'
  const busyLabel = mode === 'in' ? 'Wird angemeldet …' : 'Konto wird erstellt …'

  return (
    <main className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-7">
          <div className="grid place-items-center h-16 w-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-xl shadow-indigo-950/50 text-3xl">
            🍼
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">BabyTracker</h1>
            <p className="text-sm text-neutral-400 mt-1">
              {mode === 'in'
                ? 'Schön, dass du wieder da bist.'
                : 'Erstelle ein Konto, um deine Einträge zu sichern & zu syncen.'}
            </p>
          </div>
        </div>

        {/* Segmented mode switch (role=tab so it never collides with the submit button) */}
        <div
          role="tablist"
          aria-label="Anmelden oder Registrieren"
          className="relative grid grid-cols-2 p-1 rounded-2xl bg-white/5 border border-white/10 mb-5"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-xl bg-indigo-600 shadow-lg shadow-indigo-950/40 transition-transform duration-250 ease-out"
            style={{ transform: mode === 'in' ? 'translateX(0)' : 'translateX(calc(100% + 0.5rem))' }}
          />
          {(['in', 'up'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`relative z-10 min-h-11 rounded-xl text-sm font-semibold transition-colors ${
                mode === m ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {m === 'in' ? 'Anmelden' : 'Registrieren'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-neutral-300">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@beispiel.de"
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-neutral-300">
              Passwort
            </label>
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'in' ? 'Dein Passwort' : 'Neues Passwort'}
                className="field pr-12"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Verbergen' : 'Anzeigen'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition"
              >
                {show ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <p className="animate-slide-down flex items-start gap-2 rounded-xl bg-red-500/12 border border-red-500/25 text-red-300 text-sm px-3 py-2.5">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </p>
          )}

          <Button type="submit" loading={busy} className="mt-1 w-full">
            {busy ? busyLabel : submitLabel}
          </Button>
        </form>

        <p className="text-center text-xs text-neutral-500 mt-6">
          Deine Einträge bleiben offline verfügbar – Sync läuft automatisch im Hintergrund.
        </p>
      </div>
    </main>
  )
}
