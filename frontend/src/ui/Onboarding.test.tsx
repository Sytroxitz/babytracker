import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { Onboarding } from './Onboarding'
import * as api from '../api/client'
import { db } from '../db/database'

test('creates first child and calls onDone', async () => {
  vi.spyOn(api, 'createChild').mockResolvedValue({
    child: { id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: 3200, createdAt: 'x', deletedAt: null, members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }] },
  })
  const onDone = vi.fn()
  render(<Onboarding token="t1" onDone={onDone} />)

  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Mia' } })
  fireEvent.change(screen.getByLabelText(/geburtsdatum/i), { target: { value: '2026-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: /anlegen/i }))

  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(await db.children.get('c1')).toBeTruthy()
  await db.children.clear()
})
