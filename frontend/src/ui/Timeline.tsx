import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/database'
import { getLogsByDay, softDeleteLog } from '../db/repository'
import { syncController } from '../sync/syncController'
import type { Child, LogRecord, LogType } from '../types'
import { roleOf } from '../children/useChildren'
import { TYPE_META } from './logMeta'
import { ConfirmDialog } from './components/ConfirmDialog'

function dayBounds(d: Date): [string, string] {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return [start.toISOString(), end.toISOString()]
}

function isToday(d: Date): boolean {
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function details(r: LogRecord): string {
  switch (r.type) {
    case 'nursing':
      return [r.side, r.durationMinutes != null ? `${r.durationMinutes} min` : null].filter(Boolean).join(' · ')
    case 'pumping':
      return [`${r.amountMl} ml`, r.side, r.storageLocation].filter(Boolean).join(' · ')
    case 'bottle':
      return `${r.amountMl} ml`
    case 'weight':
      return `${r.weightGrams} g`
  }
}

/** Per-type summary chips for the day (feeding types only). */
function summarize(rows: LogRecord[]): { type: LogType; text: string }[] {
  const order: LogType[] = ['nursing', 'pumping', 'bottle']
  return order
    .map((type) => {
      const items = rows.filter((r) => r.type === type)
      if (items.length === 0) return null
      const ml = items.reduce((sum, r) => sum + (r.amountMl ?? 0), 0)
      const text = ml > 0 ? `${items.length}× · ${ml} ml` : `${items.length}×`
      return { type, text }
    })
    .filter((x): x is { type: LogType; text: string } => x !== null)
}

export function Timeline({ child }: { child: Child }) {
  const [day, setDay] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [rows, setRows] = useState<LogRecord[]>([])
  const [pending, setPending] = useState<LogRecord | null>(null)

  const load = useCallback(async () => {
    const [s, e] = dayBounds(day)
    const all = await getLogsByDay(db, child.id, s, e)
    // Gewicht erscheint auf der Gewichtsseite – hier nur Fütter-Einträge.
    setRows(all.filter((r) => r.type !== 'weight'))
  }, [day, child.id])

  useEffect(() => {
    void load()
  }, [load])

  // Reload when a sync pulls changes (e.g. a partner added an entry).
  useEffect(() => syncController.onSynced(() => void load()), [load])

  async function confirmRemove() {
    if (!pending) return
    const id = pending.id
    setPending(null)
    await softDeleteLog(db, id)
    void syncController.requestSync()
    await load()
  }

  function shift(delta: number) {
    const d = new Date(day)
    d.setDate(d.getDate() + delta)
    setDay(d)
  }

  const today = isToday(day)
  const dateLabel = today
    ? 'Heute'
    : day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const summary = summarize(rows)

  return (
    <div className="p-4 max-w-md mx-auto flex flex-col gap-4">
      {/* Day navigation */}
      <div className="flex items-center justify-between card px-2 py-2">
        <button
          onClick={() => shift(-1)}
          aria-label="Vorheriger Tag"
          className="h-10 w-10 grid place-items-center rounded-xl hover:bg-white/10 text-lg transition active:scale-95"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="font-semibold">{dateLabel}</div>
          {!today && <div className="text-xs text-neutral-500">{day.toLocaleDateString()}</div>}
        </div>
        <button
          onClick={() => shift(1)}
          aria-label="Nächster Tag"
          disabled={today}
          className="h-10 w-10 grid place-items-center rounded-xl hover:bg-white/10 text-lg transition active:scale-95 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {/* Day summary */}
      {summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.map(({ type, text }) => (
            <span
              key={type}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${TYPE_META[type].chip}`}
            >
              <span>{TYPE_META[type].icon}</span>
              <span className="font-medium">{TYPE_META[type].label}</span>
              <span className="opacity-70">{text}</span>
            </span>
          ))}
        </div>
      )}

      {rows.length === 0 && (
        <div className="animate-fade-in text-center py-12 text-neutral-500">
          <div className="text-4xl mb-2">🌙</div>
          <p>Keine Einträge an diesem Tag.</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5 stagger">
        {rows.map((r) => {
          const meta = TYPE_META[r.type]
          const role = roleOf(child, r.createdByUserId ?? null)
          const roleLabel = role === 'mama' ? 'Mama' : role === 'papa' ? 'Papa' : null
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl card px-3.5 py-3">
              <span className={`grid place-items-center h-11 w-11 rounded-xl text-xl shrink-0 ${meta.chip}`}>
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold leading-tight">{meta.label}</div>
                <div className="text-sm text-neutral-400 truncate">
                  {new Date(r.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {details(r) ? ` · ${details(r)}` : ''}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
              </div>
              {roleLabel && (
                <span className="text-xs text-neutral-500 shrink-0">{roleLabel}</span>
              )}
              <button
                onClick={() => setPending(r)}
                aria-label="Löschen"
                className="h-10 w-10 grid place-items-center rounded-xl text-neutral-500 hover:text-red-300 hover:bg-red-500/10 transition active:scale-90 shrink-0"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      {pending && (
        <ConfirmDialog
          title="Eintrag löschen?"
          description={`${TYPE_META[pending.type].label} um ${new Date(pending.occurredAt).toLocaleTimeString(
            [],
            { hour: '2-digit', minute: '2-digit' },
          )} wird entfernt.`}
          confirmLabel="Ja, löschen"
          onConfirm={confirmRemove}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
