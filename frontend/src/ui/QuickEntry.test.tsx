import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../db/database'
import { addLog } from '../db/repository'
import { QuickEntry } from './QuickEntry'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

test('logging a bottle stores a dirty breastmilk record', async () => {
  render(<QuickEntry />)
  await userEvent.click(screen.getByRole('button', { name: /flasche/i }))
  await userEvent.type(screen.getByLabelText(/menge/i), '90')
  await userEvent.click(screen.getByRole('button', { name: /speichern/i }))
  const rows = await db.logs.toArray()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ type: 'bottle', amountMl: 90, milkType: 'breastmilk', dirty: 1 })
})

test('side recommendation: tap a side, pick Stillen, and log it for that side', async () => {
  // Seed a left-side nursing → recommended next side is "right".
  await addLog(db, { type: 'nursing', occurredAt: new Date().toISOString(), side: 'left' })
  render(<QuickEntry />)

  // The recommendation card appears once recent logs load.
  const card = within(await screen.findByRole('group', { name: 'Seiten-Empfehlung' }))
  await userEvent.click(card.getByRole('button', { name: 'Rechts' }))
  // Choose what it was → opens the nursing form prefilled for the right side.
  await userEvent.click(card.getByRole('button', { name: /stillen/i }))

  expect(screen.getByRole('heading', { name: /stillen/i })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /speichern/i }))

  const nursing = (await db.logs.toArray()).filter((r) => r.type === 'nursing')
  expect(nursing.some((r) => r.side === 'right' && r.dirty === 1)).toBe(true)
})
