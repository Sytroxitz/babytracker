import { renderHook, waitFor, act } from '@testing-library/react'
import { createDb, setMeta } from '../db/database'
import { makeUseChildren } from './useChildren'

test('selects first child by default and switches', async () => {
  const db = createDb('test-uc-' + crypto.randomUUID())
  await db.children.bulkPut([
    { id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }] },
    { id: 'c2', name: 'Tom', gender: 'male', birthDate: '2026-03-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [] },
  ])
  await setMeta(db, 'myUserId', 'u1')
  const useChildren = makeUseChildren(db)
  const { result } = renderHook(() => useChildren())
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.activeChild?.id).toBe('c1')
  await act(async () => { await result.current.setActiveChild('c2') })
  expect(result.current.activeChild?.id).toBe('c2')
  await db.delete()
})
