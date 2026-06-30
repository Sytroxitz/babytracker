import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db/database'
import { addLog, getLogsSince } from '../db/repository'
import { syncController } from '../sync/syncController'
import type { LogRecord, LogType, NewLogInput, Side, StorageLocation } from '../types'
import { Button } from './components/Button'
import { SideSelect } from './components/SideSelect'
import { NumberField } from './components/NumberField'
import { TYPE_META, ENTRY_TYPES } from './logMeta'
import { formatDuration, lastSide } from './stats'

/** Lokale datetime-local-Eingabe (YYYY-MM-DDTHH:mm) ↔ ISO. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function QuickEntry() {
  const [active, setActive] = useState<LogType | null>(null)
  const [when, setWhen] = useState(() => toLocalInput(new Date()))
  const [side, setSide] = useState<Side | null>(null)
  const [amountMl, setAmountMl] = useState<number | null>(null)
  const [durationMinutes, setDuration] = useState<number | null>(null)
  const [storageLocation, setStorage] = useState<StorageLocation | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [recent, setRecent] = useState<LogRecord[]>([])
  const toastTimer = useRef<number | null>(null)

  const loadRecent = useCallback(async () => {
    const since = new Date(Date.now() - 3 * 86400000).toISOString()
    setRecent(await getLogsSince(db, since))
  }, [])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  function reset() {
    setActive(null)
    setWhen(toLocalInput(new Date()))
    setSide(null)
    setAmountMl(null)
    setDuration(null)
    setStorage(null)
    setNote('')
  }

  function showToast(msg: string) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = window.setTimeout(() => setToast(null), 1800)
  }

  async function save() {
    if (!active) return
    const occurredAt = new Date(when).toISOString()
    const n = note.trim() === '' ? null : note.trim()
    let input: NewLogInput
    switch (active) {
      case 'nursing':
        if (!side) return
        input = { type: 'nursing', occurredAt, side, durationMinutes, note: n }
        break
      case 'pumping':
        if (amountMl == null) return
        input = { type: 'pumping', occurredAt, amountMl, side, storageLocation, note: n }
        break
      case 'bottle':
        if (amountMl == null) return
        input = { type: 'bottle', occurredAt, amountMl, note: n }
        break
      default:
        return
    }
    const label = TYPE_META[active].label
    setSaving(true)
    try {
      await addLog(db, input)
      void syncController.requestSync()
      showToast(`${label} gespeichert`)
      reset()
      void loadRecent()
    } finally {
      setSaving(false)
    }
  }

  // ---- Picker view ----
  if (!active) {
    const side = lastSide(recent)
    const sideLabel = (s: 'left' | 'right' | 'both') =>
      s === 'left' ? 'Links' : s === 'right' ? 'Rechts' : 'Beide'
    const agoMin = side.lastAt
      ? Math.max(0, Math.round((Date.now() - Date.parse(side.lastAt)) / 60000))
      : 0

    return (
      <div className="p-4 max-w-md mx-auto">
        {/* Recommended next side (nursing/pumping) — at a glance */}
        {side.lastSide && (
          <div className="card p-4 mb-4 animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-neutral-300">Nächste Seite</span>
              <span className="text-xs text-neutral-500 truncate">
                zuletzt {sideLabel(side.lastSide)} · {side.lastType === 'pumping' ? 'Pumpen' : 'Stillen'} · vor{' '}
                {formatDuration(agoMin)}
              </span>
            </div>
            {side.recommended ? (
              <>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {(['left', 'right'] as const).map((sd) => {
                    const isRec = side.recommended === sd
                    const isLast = side.lastSide === sd
                    return (
                      <div
                        key={sd}
                        className={`relative min-h-14 rounded-xl grid place-items-center text-lg font-semibold border transition ${
                          isRec
                            ? 'bg-indigo-600/90 text-white border-indigo-400/40 shadow-lg shadow-indigo-950/30'
                            : 'bg-white/5 text-neutral-400 border-white/10'
                        }`}
                      >
                        {sd === 'left' ? 'Links' : 'Rechts'}
                        {isRec && <span className="absolute top-1.5 right-2 text-[10px] uppercase tracking-wide">empfohlen</span>}
                        {isLast && <span className="absolute bottom-1 right-2 text-[10px] text-neutral-300/70">zuletzt</span>}
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] text-neutral-500 mt-2">Nur eine Empfehlung – du kannst frei wählen.</p>
              </>
            ) : (
              <p className="text-sm text-neutral-400 mt-2">Zuletzt beide Seiten – freie Wahl.</p>
            )}
          </div>
        )}

        <h2 className="text-lg font-semibold text-neutral-200 mb-1">Was möchtest du eintragen?</h2>
        <p className="text-sm text-neutral-500 mb-4">Tippe auf eine Kategorie.</p>
        <div className="grid grid-cols-2 gap-3 stagger">
          {ENTRY_TYPES.map((t) => {
            const meta = TYPE_META[t]
            return (
              <button
                key={t}
                onClick={() => {
                  setWhen(toLocalInput(new Date()))
                  setActive(t)
                }}
                className={`group flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl
                  bg-gradient-to-br ${meta.tile} border
                  transition-transform duration-150 active:scale-[0.96]
                  focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30`}
              >
                <span className="text-4xl transition-transform group-active:scale-90">{meta.icon}</span>
                <span className="text-base font-semibold text-neutral-100">{meta.label}</span>
              </button>
            )
          })}
        </div>

        {toast && (
          <div
            role="status"
            className="animate-toast fixed left-1/2 bottom-24 z-30 flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2.5 shadow-xl shadow-emerald-950/40"
          >
            <span aria-hidden="true">✓</span>
            <span className="text-sm font-medium">{toast}</span>
          </div>
        )}
      </div>
    )
  }

  // ---- Form view ----
  const meta = TYPE_META[active]
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="p-4 flex flex-col gap-4 max-w-sm mx-auto animate-fade-in-up"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          aria-label="Zurück"
          className="h-10 w-10 grid place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-lg transition"
        >
          ‹
        </button>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          {meta.label}
        </h2>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-300">Zeitpunkt</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="field"
        />
      </div>

      {active === 'nursing' && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-300">Seite</span>
            <SideSelect value={side} onChange={setSide} />
          </div>
          <NumberField label="Dauer" suffix="min" value={durationMinutes} onChange={setDuration} />
        </>
      )}
      {active === 'pumping' && (
        <>
          <NumberField label="Menge" suffix="ml" value={amountMl} onChange={setAmountMl} />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-300">Seite</span>
            <SideSelect value={side} onChange={setSide} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-300">Lagerung</span>
            <div className="grid grid-cols-2 gap-2">
              {(['fridge', 'freezer'] as StorageLocation[]).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setStorage(storageLocation === loc ? null : loc)}
                  className={`min-h-12 rounded-xl text-sm font-medium transition active:scale-[0.97] ${
                    storageLocation === loc
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  {loc === 'fridge' ? '❄️ Kühlschrank' : '🧊 Gefrier'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {active === 'bottle' && <NumberField label="Menge" suffix="ml" value={amountMl} onChange={setAmountMl} />}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-300">Notiz (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="z. B. unruhig, gut getrunken …"
          className="field"
        />
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-3 mt-1">
        <Button type="button" variant="secondary" onClick={reset}>
          Abbrechen
        </Button>
        <Button type="submit" loading={saving}>
          {saving ? 'Speichert …' : 'Speichern'}
        </Button>
      </div>
    </form>
  )
}
