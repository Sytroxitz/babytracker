import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ChildSwitcher } from './ChildSwitcher'
import * as childrenHook from '../children/useChildren'

test('shows active child name and lists children to switch', async () => {
  const setActiveChild = vi.fn()
  vi.spyOn(childrenHook, 'useChildren').mockReturnValue({
    children: [
      { id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [{ userId: 'u1', role: 'mama', email: 'a@b.c' }] },
      { id: 'c2', name: 'Tom', gender: 'male', birthDate: '2026-03-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [] },
    ],
    activeChild: { id: 'c1', name: 'Mia', gender: 'female', birthDate: '2026-01-01', birthWeightGrams: null, createdAt: 'x', deletedAt: null, members: [] },
    activeChildId: 'c1', myUserId: 'u1', ready: true, setActiveChild, refresh: vi.fn(),
  } as unknown as ReturnType<typeof childrenHook.useChildren>)

  render(<ChildSwitcher token="t1" onAddChild={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Mia/ }))
  fireEvent.click(screen.getByRole('button', { name: /Tom/ }))
  await waitFor(() => expect(setActiveChild).toHaveBeenCalledWith('c2'))
})
