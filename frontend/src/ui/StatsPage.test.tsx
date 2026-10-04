import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../db/database'
import { addLog } from '../db/repository'
import type { Child } from '../types'
import { StatsPage } from './StatsPage'

const child: Child = {
  id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01',
  birthWeightGrams: null, createdAt: '2026-01-01', deletedAt: null, members: [],
}

beforeEach(async () => { await db.delete(); await db.open() })

test('shows the seven-day average hint and a colored change badge', async () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString()
  for (const [days, amount] of [[10, 80], [9, 100], [2, 120], [1, 140]]) {
    await addLog(db, 'c1', null, { type: 'bottle', occurredAt: daysAgo(days), amountMl: amount })
  }

  render(<StatsPage
    child={child}
    remindersEnabled={false}
    onToggleReminders={() => {}}
    appVersion="test"
    onCheckUpdates={() => {}}
    onHardReset={() => {}}
    onOpenAbout={() => {}}
  />)

  expect((await screen.findAllByText('Ø 7 Tage')).length).toBeGreaterThan(0)
  const badge = await screen.findByLabelText('+40 ml gegenüber den 7 Tagen davor')
  expect(badge).toHaveTextContent('+40 ml')
  expect(badge.className).toContain('bg-indigo-500/20')
})

test('shows today’s meal count change against yesterday in a badge', async () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(12, 0, 0, 0)
  await addLog(db, 'c1', null, { type: 'bottle', occurredAt: yesterday.toISOString(), amountMl: 90 })
  await addLog(db, 'c1', null, { type: 'nursing', occurredAt: new Date(yesterday.getTime() + 60000).toISOString(), side: 'left' })
  await addLog(db, 'c1', null, { type: 'bottle', occurredAt: new Date().toISOString(), amountMl: 100 })

  render(<StatsPage
    child={child}
    remindersEnabled={false}
    onToggleReminders={() => {}}
    appVersion="test"
    onCheckUpdates={() => {}}
    onHardReset={() => {}}
    onOpenAbout={() => {}}
  />)

  expect(await screen.findByLabelText('−1 gegenüber gestern')).toHaveTextContent('−1')
  expect(await screen.findByLabelText('+10 ml gegenüber gestern')).toHaveTextContent('+10 ml')
})

test('opens the about page from the app section', async () => {
  const onOpenAbout = vi.fn()
  render(<StatsPage
    child={child}
    remindersEnabled={false}
    onToggleReminders={() => {}}
    appVersion="Version 42"
    onCheckUpdates={() => {}}
    onHardReset={() => {}}
    onOpenAbout={onOpenAbout}
  />)
  await userEvent.click(await screen.findByRole('button', { name: 'Über die App & Änderungen' }))
  expect(onOpenAbout).toHaveBeenCalledOnce()
})
