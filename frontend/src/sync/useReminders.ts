import { useEffect, useRef } from 'react'
import { db, getMeta } from '../db/database'
import { getLogsSince } from '../db/repository'
import { computeFeedingStats, decideReminders, lastEntryAt } from '../ui/stats'
import { scheduleFeedingReminder, showNotification } from '../notifications'

const WINDOW_DAYS = 7
const DEFAULT_INTERVAL = 180

/**
 * While `enabled`, periodically checks (foreground watchdog) whether the next
 * feeding is due or nothing has been logged for a while, and fires a
 * notification once per occurrence. Also best-effort schedules a background
 * notification for the next feeding (Chromium only).
 */
export function useReminders(enabled: boolean, childId: string | null): void {
  const dueNotified = useRef<string | null>(null)
  const inactivityNotified = useRef<string | null>(null)
  const scheduled = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !childId) return
    let stopped = false

    async function tick() {
      const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
      const logs = await getLogsSince(db, childId!, since)
      const intervalMin = (await getMeta<number>(db, 'feedIntervalMin')) ?? DEFAULT_INTERVAL
      const now = new Date()
      const stats = computeFeedingStats(logs, intervalMin, now, WINDOW_DAYS)
      const lastEntry = lastEntryAt(logs)

      const decision = decideReminders({
        nextFeedAtMs: stats.nextFeedAt ? Date.parse(stats.nextFeedAt) : null,
        lastEntryAtMs: lastEntry ? Date.parse(lastEntry) : null,
        intervalMin,
        nowMs: now.getTime(),
      })

      if (decision.feedingDue && stats.nextFeedAt && dueNotified.current !== stats.nextFeedAt) {
        dueNotified.current = stats.nextFeedAt
        void showNotification('🍼 Zeit zum Füttern', {
          body: 'Die nächste Mahlzeit wäre jetzt fällig.',
          tag: 'feeding-due',
        })
      }

      if (decision.inactivity && lastEntry && inactivityNotified.current !== lastEntry) {
        inactivityNotified.current = lastEntry
        void showNotification('📝 Erinnerung', {
          body: 'Du hast länger nichts eingetragen – alles ok?',
          tag: 'log-reminder',
        })
      }

      // Best-effort background schedule (only once per distinct next-feed time, and only if in the future)
      if (stats.nextFeedAt && !decision.feedingDue && scheduled.current !== stats.nextFeedAt) {
        scheduled.current = stats.nextFeedAt
        void scheduleFeedingReminder(Date.parse(stats.nextFeedAt), 'Die nächste Mahlzeit wäre jetzt fällig.')
      }
    }

    void tick()
    const id = window.setInterval(() => {
      if (!stopped) void tick()
    }, 60000)
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [enabled, childId])
}
