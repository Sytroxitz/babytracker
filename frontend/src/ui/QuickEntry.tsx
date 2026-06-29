import { useState } from 'react'
import { db } from '../db/database'
import { addLog } from '../db/repository'
import { syncController } from '../sync/syncController'
import type { LogType, NewLogInput, Side, StorageLocation } from '../types'
import { Button } from './components/Button'
import { SideSelect } from './components/SideSelect'
import { NumberField } from './components/NumberField'

/** Lokale datetime-local-Eingabe (YYYY-MM-DDTHH:mm) ↔ ISO. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const LABELS: [LogType, string][] = [
  ['nursing', 'Stillen'], ['pumping', 'Pumpen'], ['bottle', 'Flasche'], ['weight', 'Gewicht'],
]

export function QuickEntry() {
  const [active, setActive] = useState<LogType | null>(null)
  const [when, setWhen] = useState(() => toLocalInput(new Date()))
  const [side, setSide] = useState<Side | null>(null)
  const [amountMl, setAmountMl] = useState<number | null>(null)
  const [durationMinutes, setDuration] = useState<number | null>(null)
  const [weightGrams, setWeight] = useState<number | null>(null)
  const [storageLocation, setStorage] = useState<StorageLocation | null>(null)
  const [note, setNote] = useState('')

  function reset() {
    setActive(null); setWhen(toLocalInput(new Date()))
    setSide(null); setAmountMl(null); setDuration(null); setWeight(null); setStorage(null); setNote('')
  }

  async function save() {
    const occurredAt = new Date(when).toISOString()
    const n = note.trim() === '' ? null : note.trim()
    let input: NewLogInput
    switch (active) {
      case 'nursing':
        if (!side) return
        input = { type: 'nursing', occurredAt, side, durationMinutes, note: n }; break
      case 'pumping':
        if (amountMl == null) return
        input = { type: 'pumping', occurredAt, amountMl, side, storageLocation, note: n }; break
      case 'bottle':
        if (amountMl == null) return
        input = { type: 'bottle', occurredAt, amountMl, note: n }; break
      case 'weight':
        if (weightGrams == null) return
        input = { type: 'weight', occurredAt, weightGrams, note: n }; break
      default: return
    }
    await addLog(db, input)
    void syncController.requestSync()
    reset()
  }

  if (!active) {
    return (
      <div className="p-4 grid grid-cols-2 gap-4">
        {LABELS.map(([t, label]) => (
          <Button key={t} className="aspect-square !text-xl" onClick={() => { setWhen(toLocalInput(new Date())); setActive(t) }}>
            {label}
          </Button>
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }} className="p-4 flex flex-col gap-4 max-w-sm mx-auto">
      <h2 className="text-xl font-semibold">{LABELS.find(([t]) => t === active)![1]}</h2>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-400">Zeitpunkt</span>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
          className="min-h-12 rounded-xl bg-neutral-900 px-4 text-lg" />
      </label>

      {active === 'nursing' && <>
        <span className="text-sm text-neutral-400">Seite</span>
        <SideSelect value={side} onChange={setSide} />
        <NumberField label="Dauer" suffix="min" value={durationMinutes} onChange={setDuration} />
      </>}
      {active === 'pumping' && <>
        <NumberField label="Menge" suffix="ml" value={amountMl} onChange={setAmountMl} />
        <span className="text-sm text-neutral-400">Seite</span>
        <SideSelect value={side} onChange={setSide} />
        <div className="grid grid-cols-2 gap-2">
          {(['fridge', 'freezer'] as StorageLocation[]).map((loc) => (
            <button key={loc} type="button" onClick={() => setStorage(loc)}
              className={`min-h-12 rounded-xl ${storageLocation === loc ? 'bg-indigo-600' : 'bg-neutral-800'}`}>
              {loc === 'fridge' ? 'Kühlschrank' : 'Gefrier'}
            </button>
          ))}
        </div>
      </>}
      {active === 'bottle' && <NumberField label="Menge" suffix="ml" value={amountMl} onChange={setAmountMl} />}
      {active === 'weight' && <NumberField label="Gewicht" suffix="g" value={weightGrams} onChange={setWeight} />}

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-400">Notiz</span>
        <input value={note} onChange={(e) => setNote(e.target.value)}
          className="min-h-12 rounded-xl bg-neutral-900 px-4 text-lg" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={reset} className="min-h-14 rounded-2xl bg-neutral-800 text-lg">Abbrechen</button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  )
}
