import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { db } from '../db/database'
import { addLog } from '../db/repository'
import { WeightChart } from './WeightChart'

beforeEach(async () => { await db.delete(); await db.open() })

test('renders a polyline point per weight entry', async () => {
  await addLog(db, { type: 'weight', occurredAt: '2026-06-01T08:00:00Z', weightGrams: 4000 })
  await addLog(db, { type: 'weight', occurredAt: '2026-06-05T08:00:00Z', weightGrams: 4200 })
  render(<WeightChart />)
  const poly = await screen.findByTestId('weight-line')
  // zwei Punkte → zwei Koordinatenpaare
  expect(poly.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(2)
})

test('empty series shows a hint', async () => {
  render(<WeightChart />)
  expect(await screen.findByText(/keine gewichtsdaten/i)).toBeInTheDocument()
})
