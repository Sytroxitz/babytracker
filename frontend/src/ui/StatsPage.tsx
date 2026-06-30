import { useEffect, useState } from 'react'
import { db, getMeta, setMeta } from '../db/database'
import { getLogsSince } from '../db/repository'
import type { LogRecord } from '../types'
import { computeFeedingStats, formatDuration, formatRelative } from './stats'
import { notificationPermission, notificationsSupported } from '../notifications'

interface Props {
  remindersEnabled: boolean
  onToggleReminders: () => void | Promise<void>
}

const INTERVAL_KEY = 'feedIntervalMin'
const DEFAULT_INTERVAL = 180
const WINDOW_DAYS = 7
const PRESETS = [120, 150, 180, 210, 240]

function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-3.5">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-xl font-bold mt-1 leading-tight">{value}</div>
      {hint && <div className="text-xs text-neutral-500 mt-0.5">{hint}</div>}
    </div>
  )
}

export function StatsPage({ remindersEnabled, onToggleReminders }: Props) {
  const now = useNow()
  const [logs, setLogs] = useState<LogRecord[]>([])
  const [intervalMin, setIntervalMin] = useState(DEFAULT_INTERVAL)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      const stored = await getMeta<number>(db, INTERVAL_KEY)
      if (typeof stored === 'number') setIntervalMin(stored)
      const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
      setLogs(await getLogsSince(db, since))
      setReady(true)
    })()
  }, [])

  async function changeInterval(next: number) {
    const clamped = Math.max(30, Math.min(480, next))
    setIntervalMin(clamped)
    await setMeta(db, INTERVAL_KEY, clamped)
  }

  if (!ready) return null

  const s = computeFeedingStats(logs, intervalMin, now, WINDOW_DAYS)
  const next = s.nextFeedAt ? formatRelative(Date.parse(s.nextFeedAt), now.getTime()) : null
  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–'

  return (
    <div className="p-4 max-w-md mx-auto flex flex-col gap-4 animate-fade-in-up">
      <h2 className="text-xl font-semibold">Statistik &amp; Prognose</h2>

      {/* Prediction hero */}
      {s.nextFeedAt ? (
        <div
          className={`rounded-2xl p-5 border bg-gradient-to-br ${
            next?.overdue
              ? 'from-amber-500/20 to-amber-500/5 border-amber-400/30'
              : 'from-indigo-500/20 to-indigo-500/5 border-indigo-400/30'
          }`}
        >
          <div className="text-sm text-neutral-300">Nächste Mahlzeit</div>
          <div className="flex items-baseline gap-3 mt-1">
            <div className="text-4xl font-bold tracking-tight">{fmtTime(s.nextFeedAt)}</div>
            <div className="text-3xl">{next?.overdue ? '🔔' : '🍼'}</div>
          </div>
          <div className={`mt-1 font-medium ${next?.overdue ? 'text-amber-300' : 'text-indigo-300'}`}>
            {next?.text}
          </div>
          <div className="text-xs text-neutral-400 mt-2">
            Basierend auf der letzten Mahlzeit ({fmtTime(s.lastFeedAt)}) + Intervall.
          </div>
        </div>
      ) : (
        <div className="card p-5 text-center text-neutral-400">
          <div className="text-3xl mb-2">🍼</div>
          Noch keine Mahlzeit erfasst – trag eine im Tab „Erfassen" ein, dann erscheint hier die Prognose.
        </div>
      )}

      {/* Reminders */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-300">Erinnerungen</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {!notificationsSupported()
                ? 'Von diesem Browser nicht unterstützt.'
                : notificationPermission() === 'denied'
                  ? 'In den Browser-Einstellungen blockiert – dort wieder erlauben.'
                  : remindersEnabled
                    ? 'Du wirst erinnert, wenn die nächste Mahlzeit fällig ist – und falls länger nichts eingetragen wurde.'
                    : 'Benachrichtigung, wenn die nächste Mahlzeit fällig ist.'}
            </div>
          </div>
          <button
            role="switch"
            aria-checked={remindersEnabled}
            aria-label="Erinnerungen"
            onClick={() => void onToggleReminders()}
            disabled={!notificationsSupported() || notificationPermission() === 'denied'}
            className={`relative h-7 w-12 rounded-full transition-colors shrink-0 disabled:opacity-40 ${
              remindersEnabled ? 'bg-indigo-600' : 'bg-white/15'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                remindersEnabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
        {remindersEnabled && (
          <p className="text-[11px] text-neutral-500 mt-2">
            Hinweis: Erinnerungen kommen zuverlässig, solange die App geöffnet ist (auch im Hintergrund-Tab).
          </p>
        )}
      </div>

      {/* Interval setting */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-neutral-300">Fütter-Intervall</div>
          <div className="text-lg font-bold">{formatDuration(intervalMin)}</div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => void changeInterval(intervalMin - 15)}
            aria-label="Intervall verringern"
            className="h-11 w-11 grid place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-xl transition active:scale-95"
          >
            −
          </button>
          <div className="flex-1 text-center text-neutral-400 text-sm">±15 Min</div>
          <button
            type="button"
            onClick={() => void changeInterval(intervalMin + 15)}
            aria-label="Intervall erhöhen"
            className="h-11 w-11 grid place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-xl transition active:scale-95"
          >
            ＋
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2 mt-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => void changeInterval(p)}
              className={`min-h-10 rounded-lg text-xs font-medium transition active:scale-95 ${
                intervalMin === p ? 'bg-indigo-600 text-white' : 'bg-white/5 text-neutral-300 hover:bg-white/10'
              }`}
            >
              {formatDuration(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Mahlzeiten heute" value={String(s.feedsToday)} />
        <StatCard label="Letzte Mahlzeit" value={fmtTime(s.lastFeedAt)} />
        <StatCard
          label="Ø Intervall"
          value={s.avgIntervalMin != null ? formatDuration(s.avgIntervalMin) : '–'}
          hint={`letzte ${WINDOW_DAYS} Tage`}
        />
        <StatCard label="Mahlzeiten / Tag" value={String(s.feedsPerDay)} hint={`Ø ${WINDOW_DAYS} Tage`} />
        <StatCard label="Ø Flasche" value={s.avgBottleMl != null ? `${s.avgBottleMl} ml` : '–'} />
        <StatCard label="Flasche heute" value={`${s.bottleMlToday} ml`} />
      </div>

      <p className="text-xs text-neutral-500 text-center">
        Prognose & Statistik basieren auf Still- und Flaschen-Einträgen der letzten {WINDOW_DAYS} Tage.
      </p>
    </div>
  )
}
