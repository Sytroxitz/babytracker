import { useState } from 'react'
import type { Gender, Role } from '../types'
import { createChild, acceptInvitation, AuthError } from '../api/client'
import { db, getMeta } from '../db/database'
import { addLog } from '../db/repository'
import { syncController } from '../sync/syncController'
import { Button } from './components/Button'

export function Onboarding({
  token,
  onDone,
  onSignOut,
}: {
  token: string
  onDone: () => void
  onSignOut?: () => void
}) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('female')
  const [birthDate, setBirthDate] = useState('')
  const [weight, setWeight] = useState('')
  const [role, setRole] = useState<Role>('mama')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionInvalid, setSessionInvalid] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const birthWeightGrams = weight ? Number(weight) : null
      const res =
        mode === 'create'
          ? await createChild(token, {
              name,
              gender,
              birthDate,
              birthWeightGrams,
              role,
            })
          : await acceptInvitation(token, code.trim().toUpperCase(), role)
      await db.children.put(res.child)

      // Seed the birth weight as the first weight entry so it shows up in the
      // weight chart right away (create flow only).
      if (mode === 'create' && birthWeightGrams && birthWeightGrams > 0) {
        const myUserId = (await getMeta<string>(db, 'myUserId')) ?? null
        await addLog(db, res.child.id, myUserId, {
          type: 'weight',
          occurredAt: birthDate ? new Date(birthDate).toISOString() : new Date().toISOString(),
          weightGrams: birthWeightGrams,
          note: 'Geburtsgewicht',
        })
        void syncController.requestSync()
      }
      onDone()
    } catch (e) {
      // An invalid/expired token can't be recovered here — the user must
      // re-authenticate. Surface a clear re-login path instead of a raw error.
      if (e instanceof AuthError) setSessionInvalid(true)
      else setError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Brand / heading */}
        <div className="flex flex-col items-center gap-3 mb-7">
          <div className="grid place-items-center h-16 w-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-xl shadow-indigo-950/50 text-3xl">
            👶
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Willkommen</h1>
            <p className="text-sm text-neutral-400 mt-1">
              {mode === 'create'
                ? 'Leg dein erstes Kind an und starte direkt.'
                : 'Gib den Einladungs-Code ein, den du erhalten hast.'}
            </p>
          </div>
        </div>

        {/* Mode switcher */}
        <div
          role="tablist"
          aria-label="Kind anlegen oder beitreten"
          className="relative grid grid-cols-2 p-1 rounded-2xl bg-white/5 border border-white/10 mb-5"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-xl bg-indigo-600 shadow-lg shadow-indigo-950/40 transition-transform duration-250 ease-out"
            style={{ transform: mode === 'create' ? 'translateX(0)' : 'translateX(calc(100% + 0.5rem))' }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            onClick={() => { setMode('create'); setError(null) }}
            className={`relative z-10 min-h-11 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'create' ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Kind anlegen
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'join'}
            onClick={() => { setMode('join'); setError(null) }}
            className={`relative z-10 min-h-11 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'join' ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Ich wurde eingeladen
          </button>
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-4">
          {mode === 'create' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ob-name" className="text-sm font-medium text-neutral-300">
                  Name
                </label>
                <input
                  id="ob-name"
                  aria-label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Rose"
                  className="field"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="ob-gender" className="text-sm font-medium text-neutral-300">
                  Geschlecht
                </label>
                <select
                  id="ob-gender"
                  aria-label="Geschlecht"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="field"
                >
                  <option value="female">Mädchen</option>
                  <option value="male">Junge</option>
                  <option value="diverse">Divers</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="ob-birthdate" className="text-sm font-medium text-neutral-300">
                  Geburtsdatum
                </label>
                <input
                  id="ob-birthdate"
                  aria-label="Geburtsdatum"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="field"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="ob-weight" className="text-sm font-medium text-neutral-300">
                  Geburtsgewicht (g)
                </label>
                <input
                  id="ob-weight"
                  aria-label="Geburtsgewicht"
                  inputMode="numeric"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="z. B. 3200"
                  className="field"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ob-code" className="text-sm font-medium text-neutral-300">
                Einladungs-Code
              </label>
              <input
                id="ob-code"
                aria-label="Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="z. B. ABC123"
                autoCapitalize="characters"
                className="field tracking-widest"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ob-role" className="text-sm font-medium text-neutral-300">
              Ich bin
            </label>
            <select
              id="ob-role"
              aria-label="Rolle"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="field"
            >
              <option value="mama">Mama</option>
              <option value="papa">Papa</option>
            </select>
          </div>

          {sessionInvalid && (
            <div className="animate-slide-down rounded-xl bg-amber-500/12 border border-amber-500/25 text-amber-200 text-sm px-3 py-3">
              <p className="flex items-start gap-2">
                <span aria-hidden="true">⚠️</span>
                <span>Deine Sitzung ist abgelaufen oder ungültig. Bitte melde dich neu an.</span>
              </p>
              {onSignOut && (
                <Button type="button" onClick={onSignOut} className="mt-3 w-full">
                  Neu anmelden
                </Button>
              )}
            </div>
          )}

          {error && (
            <p className="animate-slide-down flex items-start gap-2 rounded-xl bg-red-500/12 border border-red-500/25 text-red-300 text-sm px-3 py-2.5">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </p>
          )}

          {!sessionInvalid && (
            <Button
              type="button"
              loading={busy}
              onClick={submit}
              className="mt-1 w-full"
            >
              {mode === 'create' ? 'Anlegen' : 'Beitreten'}
            </Button>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="mx-auto text-sm text-neutral-500 hover:text-neutral-300 underline-offset-2 hover:underline transition"
            >
              Abmelden
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
