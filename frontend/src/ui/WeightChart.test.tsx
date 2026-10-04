import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { db } from '../db/database'
import { addLog } from '../db/repository'
import { WeightChart } from './WeightChart'

beforeEach(async () => { await db.delete(); await db.open() })

test('renders a polyline point per weight entry', async () => {
  await addLog(db, 'c1', null, { type: 'weight', occurredAt: '2026-06-01T08:00:00Z', weightGrams: 4000 })
  await addLog(db, 'c1', null, { type: 'weight', occurredAt: '2026-06-05T08:00:00Z', weightGrams: 4200 })
  render(<WeightChart childId="c1" />)
  const poly = await screen.findByTestId('weight-line')
  // zwei Punkte → zwei Koordinatenpaare
  expect(poly.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(2)
})

test('empty series shows a hint', async () => {
  render(<WeightChart childId="c1" />)
  expect(await screen.findByText(/keine gewichtsdaten/i)).toBeInTheDocument()
})

test('renders height measurements with centimetre labels', async () => {
  await addLog(db, 'c1', null, { type: 'height', occurredAt: '2026-06-01T08:00:00Z', heightCm: 50 })
  await addLog(db, 'c1', null, { type: 'height', occurredAt: '2026-06-05T08:00:00Z', heightCm: 52.5 })
  render(<WeightChart childId="c1" type="height" />)
  const line = await screen.findByTestId('height-line')
  expect(line.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(2)
  expect(screen.getByText('52.5 cm')).toBeInTheDocument()
})
