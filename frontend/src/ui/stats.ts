import type { LogRecord } from '../types'

export interface FeedingStats {
  totalFeeds: number
  lastFeedAt: string | null
  /** ISO timestamp of the predicted next feeding (lastFeed + interval), or null. */
  nextFeedAt: string | null
  feedsToday: number
  feedsPerDay: number
  avgIntervalMin: number | null
  avgBottleMl: number | null
  bottleMlToday: number
  nursingCount: number
  bottleCount: number
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Aggregates feeding statistics and the next-feeding prediction.
 * "Feeding" = nursing or bottle (a meal, regardless of method). The next feeding
 * is predicted as the most recent feeding + the configured interval.
 */
export function computeFeedingStats(
  logs: LogRecord[],
  intervalMin: number,
  now: Date,
  windowDays = 7,
): FeedingStats {
  const feeds = logs
    .filter((r) => (r.type === 'nursing' || r.type === 'bottle') && r.deletedAt === null)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))

  const last = feeds.length ? feeds[feeds.length - 1] : null
  const nextFeedAt = last
    ? new Date(Date.parse(last.occurredAt) + intervalMin * 60000).toISOString()
    : null

  const feedsToday = feeds.filter((r) => sameDay(new Date(r.occurredAt), now)).length

  let avgIntervalMin: number | null = null
  if (feeds.length >= 2) {
    let sum = 0
    for (let i = 1; i < feeds.length; i++) {
      sum += Date.parse(feeds[i].occurredAt) - Date.parse(feeds[i - 1].occurredAt)
    }
    avgIntervalMin = Math.round(sum / (feeds.length - 1) / 60000)
  }

  const bottles = feeds.filter((r) => r.type === 'bottle')
  const avgBottleMl = bottles.length
    ? Math.round(bottles.reduce((s, r) => s + (r.amountMl ?? 0), 0) / bottles.length)
    : null
  const bottleMlToday = bottles
    .filter((r) => sameDay(new Date(r.occurredAt), now))
    .reduce((s, r) => s + (r.amountMl ?? 0), 0)

  return {
    totalFeeds: feeds.length,
    lastFeedAt: last?.occurredAt ?? null,
    nextFeedAt,
    feedsToday,
    feedsPerDay: Math.round((feeds.length / windowDays) * 10) / 10,
    avgIntervalMin,
    avgBottleMl,
    bottleMlToday,
    nursingCount: feeds.filter((r) => r.type === 'nursing').length,
    bottleCount: bottles.length,
  }
}

export interface SideInfo {
  lastSide: 'left' | 'right' | 'both' | null
  lastType: 'nursing' | 'pumping' | null
  lastAt: string | null
  /** Recommended next side (the opposite of the last left/right); null if last was "both" or none. */
  recommended: 'left' | 'right' | null
}

/** Most recent nursing/pumping side and the recommended next side (opposite). */
export function lastSide(logs: LogRecord[]): SideInfo {
  const withSide = logs
    .filter(
      (r) =>
        (r.type === 'nursing' || r.type === 'pumping') &&
        r.deletedAt === null &&
        (r.side === 'left' || r.side === 'right' || r.side === 'both'),
    )
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
  const last = withSide[0]
  if (!last) return { lastSide: null, lastType: null, lastAt: null, recommended: null }
  const recommended = last.side === 'left' ? 'right' : last.side === 'right' ? 'left' : null
  return {
    lastSide: last.side as 'left' | 'right' | 'both',
    lastType: last.type as 'nursing' | 'pumping',
    lastAt: last.occurredAt,
    recommended,
  }
}

/** Latest occurredAt across all non-deleted logs (for the "you haven't logged" reminder). */
export function lastEntryAt(logs: LogRecord[]): string | null {
  const active = logs.filter((r) => r.deletedAt === null)
  if (active.length === 0) return null
  return active.reduce((max, r) => (Date.parse(r.occurredAt) > Date.parse(max) ? r.occurredAt : max), active[0].occurredAt)
}

export interface ReminderDecision {
  feedingDue: boolean
  inactivity: boolean
}

/** Pure decision: which reminders are currently due. */
export function decideReminders(opts: {
  nextFeedAtMs: number | null
  lastEntryAtMs: number | null
  intervalMin: number
  nowMs: number
}): ReminderDecision {
  const feedingDue = opts.nextFeedAtMs != null && opts.nextFeedAtMs <= opts.nowMs
  const inactivity =
    opts.lastEntryAtMs != null && opts.nowMs - opts.lastEntryAtMs > (opts.intervalMin + 45) * 60000
  return { feedingDue, inactivity }
}

/** Formats minutes as e.g. "3 Std 15 Min" or "45 Min". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h <= 0) return `${m} Min`
  if (m === 0) return `${h} Std`
  return `${h} Std ${m} Min`
}

/** Relative time (German) of a target vs now, in ms. */
export function formatRelative(targetMs: number, nowMs: number): { text: string; overdue: boolean } {
  const diff = targetMs - nowMs
  const overdue = diff < 0
  const totalMin = Math.round(Math.abs(diff) / 60000)
  if (totalMin === 0) return { text: 'jetzt fällig', overdue: false }
  const hm = formatDuration(totalMin)
  return { text: overdue ? `überfällig seit ${hm}` : `in ${hm}`, overdue }
}
