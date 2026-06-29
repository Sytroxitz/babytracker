import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/database'
import { getLogsByDay, softDeleteLog } from '../db/repository'
import { syncController } from '../sync/syncController'
import type { LogRecord } from '../types'

const TYPE_LABEL: Record<LogRecord['type'], string> = {
  nursing: 'Stillen', pumping: 'Pumpen', bottle: 'Flasche', weight: 'Gewicht',
}

function dayBounds(d: Date): [string, string] {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return [start.toISOString(), end.toISOString()]
}

function details(r: LogRecord): string {
  switch (r.type) {
    case 'nursing': return [r.side, r.durationMinutes != null ? `${r.durationMinutes} min` : null].filter(Boolean).join(' · ')
    case 'pumping': return [`${r.amountMl} ml`, r.side, r.storageLocation].filter(Boolean).join(' · ')
    case 'bottle': return `${r.amountMl} ml`
    case 'weight': return `${r.weightGrams} g`
  }
}

export function Timeline() {
  const [day, setDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [rows, setRows] = useState<LogRecord[]>([])

  const load = useCallback(async () => {
    const [s, e] = dayBounds(day)
    setRows(await getLogsByDay(db, s, e))
  }, [day])

  useEffect(() => { void load() }, [load])

  async function remove(id: string) {
    await softDeleteLog(db, id)
    void syncController.requestSync()
    await load()
  }

  function shift(delta: number) { const d = new Date(day); d.setDate(d.getDate() + delta); setDay(d) }

  return (
    <div className="p-4 max-w-md mx-auto flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="min-h-12 px-4 rounded-xl bg-neutral-800">‹</button>
        <span className="text-sm text-neutral-300">{day.toLocaleDateString()}</span>
        <button onClick={() => shift(1)} className="min-h-12 px-4 rounded-xl bg-neutral-800">›</button>
      </div>
      {rows.length === 0 && <p className="text-neutral-500 text-center py-8">Keine Einträge.</p>}
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3">
          <div>
            <div className="font-medium">{TYPE_LABEL[r.type]}</div>
            <div className="text-sm text-neutral-400">
              {new Date(r.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {details(r)}
              {r.note ? ` · ${r.note}` : ''}
            </div>
          </div>
          <button onClick={() => remove(r.id)} aria-label="Löschen" className="text-red-400 px-3 min-h-12">✕</button>
        </div>
      ))}
    </div>
  )
}
