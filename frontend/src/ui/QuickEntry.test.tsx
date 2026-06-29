import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../db/database'
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
