import { expect, test } from 'vitest'
import {
  computeFeedingStats,
  decideReminders,
  formatDuration,
  formatRelative,
  lastEntryAt,
  lastSide,
} from './stats'
import type { LogRecord } from '../types'

/** ISO string for a LOCAL date (timezone-independent test assertions). */
function at(hour: number, day = 30, minute = 0): string {
  return new Date(2026, 5, day, hour, minute, 0).toISOString()
}

function rec(p: Partial<LogRecord> & Pick<LogRecord, 'type' | 'occurredAt'>): LogRecord {
  return {
    id: crypto.randomUUID(),
    updatedAt: p.occurredAt,
    deletedAt: null,
    serverSeq: null,
    dirty: 0,
    ...p,
  } as LogRecord
}

const NOW = new Date(2026, 5, 30, 12, 0, 0)

test('computeFeedingStats predicts next feed and aggregates correctly', () => {
  const logs: LogRecord[] = [
    rec({ type: 'bottle', occurredAt: at(10, 28), amountMl: 80 }), // 2 days ago
    rec({ type: 'bottle', occurredAt: at(6), amountMl: 100 }), // today
    rec({ type: 'nursing', occurredAt: at(9), side: 'left' }), // today
    rec({ type: 'bottle', occurredAt: at(11), amountMl: 120 }), // today (last feed)
    rec({ type: 'weight', occurredAt: at(8), weightGrams: 4200 }), // not a feeding
    rec({ type: 'bottle', occurredAt: at(10), amountMl: 200, deletedAt: at(10) }), // deleted → ignored
  ]

  const s = computeFeedingStats(logs, 180, NOW)

  expect(s.totalFeeds).toBe(4)
  expect(s.lastFeedAt).toBe(at(11))
  expect(s.nextFeedAt).toBe(new Date(Date.parse(at(11)) + 180 * 60000).toISOString())
  expect(s.feedsToday).toBe(3) // the 28th is excluded
  expect(s.avgIntervalMin).toBe(980) // (2640 + 180 + 120) / 3
  expect(s.avgBottleMl).toBe(100) // (80 + 100 + 120) / 3
  expect(s.bottleMlToday).toBe(220) // 100 + 120 (deleted 200 excluded)
  expect(s.feedsPerDay).toBe(0.6) // 4 / 7
  expect(s.nursingCount).toBe(1)
  expect(s.bottleCount).toBe(3)
})

test('computeFeedingStats handles no feedings', () => {
  const s = computeFeedingStats([], 180, NOW)
  expect(s.totalFeeds).toBe(0)
  expect(s.lastFeedAt).toBeNull()
  expect(s.nextFeedAt).toBeNull()
  expect(s.avgIntervalMin).toBeNull()
  expect(s.avgBottleMl).toBeNull()
})

test('formatDuration formats hours and minutes', () => {
  expect(formatDuration(195)).toBe('3 Std 15 Min')
  expect(formatDuration(45)).toBe('45 Min')
  expect(formatDuration(120)).toBe('2 Std')
})

test('formatRelative describes future and overdue', () => {
  const now = NOW.getTime()
  expect(formatRelative(now + 80 * 60000, now)).toEqual({ text: 'in 1 Std 20 Min', overdue: false })
  expect(formatRelative(now - 10 * 60000, now)).toEqual({ text: 'überfällig seit 10 Min', overdue: true })
  expect(formatRelative(now, now).text).toBe('jetzt fällig')
})

test('lastSide returns the most recent side and recommends the opposite', () => {
  const logs: LogRecord[] = [
    rec({ type: 'nursing', occurredAt: at(8), side: 'left' }),
    rec({ type: 'pumping', occurredAt: at(11), side: 'right', amountMl: 100 }), // most recent with side
    rec({ type: 'bottle', occurredAt: at(12), amountMl: 90 }), // no side, ignored
  ]
  const info = lastSide(logs)
  expect(info.lastSide).toBe('right')
  expect(info.lastType).toBe('pumping')
  expect(info.recommended).toBe('left')
})

test('lastSide ignores deleted entries and handles none/both', () => {
  expect(lastSide([]).recommended).toBeNull()
  const both = lastSide([rec({ type: 'nursing', occurredAt: at(9), side: 'both' })])
  expect(both.lastSide).toBe('both')
  expect(both.recommended).toBeNull()
  const deleted = lastSide([rec({ type: 'nursing', occurredAt: at(10), side: 'left', deletedAt: at(10) })])
  expect(deleted.lastSide).toBeNull()
})

test('lastEntryAt returns the newest non-deleted occurredAt', () => {
  const logs: LogRecord[] = [
    rec({ type: 'bottle', occurredAt: at(8), amountMl: 90 }),
    rec({ type: 'nursing', occurredAt: at(15), side: 'left' }),
    rec({ type: 'bottle', occurredAt: at(20), amountMl: 90, deletedAt: at(20) }),
  ]
  expect(lastEntryAt(logs)).toBe(at(15))
  expect(lastEntryAt([])).toBeNull()
})

test('decideReminders flags feeding-due and inactivity', () => {
  const now = NOW.getTime()
  // feeding due when next feed time has passed
  expect(decideReminders({ nextFeedAtMs: now - 1, lastEntryAtMs: now, intervalMin: 180, nowMs: now }).feedingDue).toBe(true)
  expect(decideReminders({ nextFeedAtMs: now + 60000, lastEntryAtMs: now, intervalMin: 180, nowMs: now }).feedingDue).toBe(false)
  // inactivity when last entry older than interval + 45 min
  const stale = now - (180 + 46) * 60000
  expect(decideReminders({ nextFeedAtMs: null, lastEntryAtMs: stale, intervalMin: 180, nowMs: now }).inactivity).toBe(true)
  const fresh = now - 30 * 60000
  expect(decideReminders({ nextFeedAtMs: null, lastEntryAtMs: fresh, intervalMin: 180, nowMs: now }).inactivity).toBe(false)
})
