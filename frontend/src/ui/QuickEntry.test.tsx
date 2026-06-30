import { beforeEach, expect, test } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../db/database'
import { addLog } from '../db/repository'
import type { Child } from '../types'
import { QuickEntry } from './QuickEntry'

const sampleChild: Child = {
  id: 'c1',
  name: 'Mia',
  gender: 'female',
  birthDate: '2026-01-01',
  birthWeightGrams: null,
  createdAt: 'x',
  deletedAt: null,
  members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }],
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

test('logging a bottle stores a dirty breastmilk record', async () => {
  render(<QuickEntry child={sampleChild} myUserId="u1" />)
  await userEvent.click(screen.getByRole('button', { name: /flasche/i }))
  await userEvent.type(screen.getByLabelText(/menge/i), '90')
  await userEvent.click(screen.getByRole('button', { name: /speichern/i }))
  const rows = await db.logs.toArray()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ type: 'bottle', amountMl: 90, milkType: 'breastmilk', dirty: 1 })
})

test('side recommendation: tap a side, pick Stillen → logs nursing immediately for that side', async () => {
  // Seed a left-side nursing → recommended next side is "right".
  await addLog(db, 'c1', null, { type: 'nursing', occurredAt: new Date().toISOString(), side: 'left' })
  render(<QuickEntry child={sampleChild} myUserId="u1" />)

  // The recommendation card appears once recent logs load.
  const card = within(await screen.findByRole('group', { name: 'Seiten-Empfehlung' }))
  await userEvent.click(card.getByRole('button', { name: 'Rechts' }))
  // Choosing Stillen logs it immediately (no form, no extra Speichern step).
  await userEvent.click(card.getByRole('button', { name: /stillen/i }))

  await waitFor(async () => {
    const nursing = (await db.logs.toArray()).filter((r) => r.type === 'nursing')
    expect(nursing.some((r) => r.side === 'right' && r.dirty === 1)).toBe(true)
  })
})
