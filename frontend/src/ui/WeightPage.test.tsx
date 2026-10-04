import { beforeEach, expect, test } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../db/database'
import { WeightPage } from './WeightPage'
import type { Child } from '../types'

const child: Child = {
  id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01',
  birthWeightGrams: null, createdAt: '2026-01-01', deletedAt: null, members: [],
}

beforeEach(async () => { await db.delete(); await db.open() })

test('saves a height measurement and shows it in the growth view', async () => {
  render(<WeightPage child={child} myUserId={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'Größe' }))
  fireEvent.click(screen.getByRole('button', { name: /größe eintragen/i }))
  fireEvent.change(screen.getByLabelText('Größe (cm)'), { target: { value: '52.5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

  await waitFor(async () => {
    const rows = await db.logs.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'height', heightCm: 52.5, childId: 'c1' })
  })
  expect((await screen.findAllByText('52.5 cm')).length).toBeGreaterThan(0)
})
