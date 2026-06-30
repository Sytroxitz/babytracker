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

test('logs the entered birth weight as the first weight entry for the child', async () => {
  vi.spyOn(api, 'createChild').mockResolvedValue({
    child: { id: 'c1', name: 'Rose', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: 3200, createdAt: 'x', deletedAt: null, members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }] },
  })
  const onDone = vi.fn()
  render(<Onboarding token="aaa.bbb.ccc" onDone={onDone} />)

  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Rose' } })
  fireEvent.change(screen.getByLabelText(/geburtsdatum/i), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText(/geburtsgewicht/i), { target: { value: '3200' } })
  fireEvent.click(screen.getByRole('button', { name: /anlegen/i }))

  await waitFor(() => expect(onDone).toHaveBeenCalled())
  const logs = await db.logs.where('childId').equals('c1').toArray()
  expect(logs).toHaveLength(1)
  expect(logs[0].type).toBe('weight')
  expect(logs[0].weightGrams).toBe(3200)
  await db.children.clear()
  await db.logs.clear()
})

test('offers re-login when the token is invalid (AuthError)', async () => {
  vi.spyOn(api, 'createChild').mockRejectedValue(new api.AuthError())
  const onSignOut = vi.fn()
  render(<Onboarding token="bad" onDone={() => {}} onSignOut={onSignOut} />)

  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Mia' } })
  fireEvent.change(screen.getByLabelText(/geburtsdatum/i), { target: { value: '2026-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: /anlegen/i }))

  const relogin = await screen.findByRole('button', { name: /neu anmelden/i })
  fireEvent.click(relogin)
  expect(onSignOut).toHaveBeenCalled()
})
