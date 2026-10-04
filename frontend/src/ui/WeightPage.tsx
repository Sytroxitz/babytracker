import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db/database'
import { addLog, getHeightSeries, getWeightSeries, softDeleteLog } from '../db/repository'
import { syncController } from '../sync/syncController'
import type { Child, LogRecord } from '../types'
import { Button } from './components/Button'
import { NumberField } from './components/NumberField'
import { ConfirmDialog } from './components/ConfirmDialog'
import { WeightChart } from './WeightChart'

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function WeightPage({ child, myUserId }: { child: Child; myUserId: string | null }) {
  const [type, setType] = useState<'weight' | 'height'>('weight')
  const [series, setSeries] = useState<LogRecord[]>([])
  const [adding, setAdding] = useState(false)
  const [grams, setGrams] = useState<number | null>(null)
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [when, setWhen] = useState(() => toLocalInput(new Date()))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<LogRecord | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const load = useCallback(async () => {
    setSeries(await (type === 'weight' ? getWeightSeries(db, child.id) : getHeightSeries(db, child.id)))
  }, [child.id, type])

  useEffect(() => {
    void load()
  }, [load])

  // Reload when a sync pulls changes from a partner.
  useEffect(() => syncController.onSynced(() => void load()), [load])

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  function showToast(msg: string) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = window.setTimeout(() => setToast(null), 1800)
  }

  function openForm() {
    setGrams(null)
    setHeightCm(null)
    setWhen(toLocalInput(new Date()))
    setNote('')
    setAdding(true)
  }

  async function save() {
    const value = type === 'weight' ? grams : heightCm
    if (value == null || !Number.isFinite(value) || value <= 0 || !when) return
    setSaving(true)
    try {
      const occurredAt = new Date(when).toISOString()
      const entryNote = note.trim() === '' ? null : note.trim()
      if (type === 'weight') {
        await addLog(db, child.id, myUserId, { type: 'weight', occurredAt, weightGrams: value, note: entryNote })
      } else {
        await addLog(db, child.id, myUserId, { type: 'height', occurredAt, heightCm: value, note: entryNote })
      }
      void syncController.requestSync()
      setAdding(false)
      await load()
      showToast(`${type === 'weight' ? 'Gewicht' : 'Größe'} gespeichert`)
    } finally {
      setSaving(false)
    }
  }

  async function confirmRemove() {
    if (!pending) return
    const id = pending.id
    setPending(null)
    await softDeleteLog(db, id)
    void syncController.requestSync()
    await load()
  }

  const isHeight = type === 'height'
  const label = isHeight ? 'Größe' : 'Gewicht'
  const unit = isHeight ? 'cm' : 'g'
  const measure = (r: LogRecord) => (isHeight ? r.heightCm : r.weightGrams)!
  const latest = series.length ? measure(series[series.length - 1]) : null
  const delta = series.length > 1 ? Math.round((latest! - measure(series[0])) * (isHeight ? 10 : 1)) / (isHeight ? 10 : 1) : null
  const newestFirst = [...series].reverse()

  return (
    <div className="p-4 max-w-md mx-auto flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-semibold">Wachstum</h2>
        {latest != null && (
          <div className="text-right">
            <div className="text-2xl font-bold leading-none">{latest} {unit}</div>
            {delta != null && (
              <div className={`text-xs mt-1 ${delta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {delta >= 0 ? '▲ +' : '▼ '}
                {delta} {unit} seit Beginn
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1" role="group" aria-label="Messart">
        {(['weight', 'height'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={type === option}
            onClick={() => { setType(option); setAdding(false); setSeries([]) }}
            className={`rounded-xl py-2 text-sm font-medium transition ${type === option ? 'bg-indigo-500 text-white' : 'text-neutral-400 hover:text-neutral-100'}`}
          >
            {option === 'weight' ? 'Gewicht' : 'Größe'}
          </button>
        ))}
      </div>

      <WeightChart series={series} type={type} />

      {/* Add weight */}
      {!adding ? (
        <Button type="button" onClick={openForm} className="w-full">
          ＋ {label} eintragen
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="card p-4 flex flex-col gap-4 animate-fade-in-up"
        >
          {isHeight
            ? <NumberField label="Größe" suffix="cm" step="0.1" value={heightCm} onChange={setHeightCm} />
            : <NumberField label="Gewicht" suffix="g" value={grams} onChange={setGrams} />}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-300">Zeitpunkt</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="field"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-300">Notiz (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z. B. nach dem Stillen"
              className="field"
            />
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Abbrechen
            </Button>
            <Button type="submit" loading={saving} disabled={isHeight ? heightCm == null || heightCm <= 0 : grams == null || grams <= 0}>
              {saving ? 'Speichert …' : 'Speichern'}
            </Button>
          </div>
        </form>
      )}

      {/* Measurement list */}
      {newestFirst.length > 0 && (
        <div className="flex flex-col gap-2.5 stagger">
          <h3 className="text-sm font-medium text-neutral-400 mt-1">Messungen</h3>
          {newestFirst.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl card px-3.5 py-3">
              <span className="grid place-items-center h-11 w-11 rounded-xl text-xl shrink-0 bg-emerald-500/15 text-emerald-200">
                {isHeight ? '📏' : '⚖️'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold leading-tight">{measure(r)} {unit}</div>
                <div className="text-sm text-neutral-400 truncate">
                  {new Date(r.occurredAt).toLocaleString([], {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
              </div>
              <button
                onClick={() => setPending(r)}
                aria-label="Löschen"
                className="h-10 w-10 grid place-items-center rounded-xl text-neutral-500 hover:text-red-300 hover:bg-red-500/10 transition active:scale-90 shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title="Messung löschen?"
          description={`${measure(pending)} ${unit} vom ${new Date(pending.occurredAt).toLocaleDateString()} wird entfernt.`}
          confirmLabel="Ja, löschen"
          onConfirm={confirmRemove}
          onCancel={() => setPending(null)}
        />
      )}

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
