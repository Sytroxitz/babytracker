import { beforeEach, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../db/database'
import { addLog } from '../db/repository'
import { Timeline } from './Timeline'

beforeEach(async () => {
  await db.delete(); await db.open()
})

test('shows today entries and soft-deletes one after confirmation', async () => {
  const today = new Date()
  today.setHours(10, 0, 0, 0)
  await addLog(db, { type: 'bottle', occurredAt: today.toISOString(), amountMl: 90 })
  render(<Timeline />)
  // "Flasche" appears (entry row + day-summary chip)
  expect((await screen.findAllByText(/flasche/i)).length).toBeGreaterThan(0)

  // Deleting requires confirmation: the row button opens a dialog, it does NOT delete yet.
  await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(await db.logs.toArray()).toHaveLength(1)
  expect((await db.logs.toArray())[0].deletedAt).toBeNull() // not deleted before confirm

  // Confirm → soft-delete happens and the entry disappears.
  await userEvent.click(screen.getByRole('button', { name: 'Ja, löschen' }))
  await waitFor(() => expect(screen.queryAllByText(/flasche/i)).toHaveLength(0))
  const rows = await db.logs.toArray()
  expect(rows[0].deletedAt).not.toBeNull()
})

test('cancelling the delete dialog keeps the entry', async () => {
  const today = new Date()
  today.setHours(10, 0, 0, 0)
  await addLog(db, { type: 'bottle', occurredAt: today.toISOString(), amountMl: 90 })
  render(<Timeline />)
  await screen.findAllByText(/flasche/i)

  await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))
  await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

  // still present, still not deleted
  expect(screen.getAllByText(/flasche/i).length).toBeGreaterThan(0)
  expect((await db.logs.toArray())[0].deletedAt).toBeNull()
})
