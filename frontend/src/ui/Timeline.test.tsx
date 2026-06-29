import { beforeEach, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../db/database'
import { addLog } from '../db/repository'
import { Timeline } from './Timeline'

beforeEach(async () => {
  await db.delete(); await db.open()
})

test('shows today entries and soft-deletes one', async () => {
  const today = new Date()
  today.setHours(10, 0, 0, 0)
  await addLog(db, { type: 'bottle', occurredAt: today.toISOString(), amountMl: 90 })
  render(<Timeline />)
  expect(await screen.findByText(/flasche/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /löschen/i }))
  // nach Soft-Delete verschwindet der Eintrag aus der Liste (waitFor: async handler)
  await waitFor(() => expect(screen.queryByText(/flasche/i)).not.toBeInTheDocument())
  const rows = await db.logs.toArray()
  expect(rows[0].deletedAt).not.toBeNull()
})
