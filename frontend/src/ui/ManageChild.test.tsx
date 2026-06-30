import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, beforeEach, test, expect } from 'vitest'
import { ManageChild } from './ManageChild'
import * as api from '../api/client'
import type { Child } from '../types'

const child: Child = {
  id: 'child-1',
  name: 'Mia',
  gender: 'female',
  birthDate: '2024-01-01',
  birthWeightGrams: 3200,
  createdAt: '2024-01-01T00:00:00Z',
  deletedAt: null,
  members: [{ userId: 'u1', role: 'mama', email: 'mama@example.com' }],
}

describe('ManageChild', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('delete confirm flow calls deleteChild and onChanged fires on success', async () => {
    vi.spyOn(api, 'deleteChild').mockResolvedValue(undefined)
    const onChanged = vi.fn()
    const onClose = vi.fn()

    render(
      <ManageChild child={child} token="t1" onClose={onClose} onChanged={onChanged} />,
    )

    // Open the confirm dialog
    fireEvent.click(screen.getByRole('button', { name: /Kind löschen/i }))
    expect(screen.getByRole('dialog', { name: 'Kind löschen?' })).toBeInTheDocument()

    // Click the confirm button inside the dialog
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    await waitFor(() =>
      expect(api.deleteChild).toHaveBeenCalledWith('t1', child.id),
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  test('trigger button is disabled while delete is in flight (prevents double-delete)', async () => {
    let resolveDelete: (() => void) | undefined
    const deleteChildSpy = vi.spyOn(api, 'deleteChild').mockImplementation(
      () => new Promise<void>((res) => { resolveDelete = res }),
    )

    const onChanged = vi.fn()
    const onClose = vi.fn()

    render(
      <ManageChild child={child} token="t1" onClose={onClose} onChanged={onChanged} />,
    )

    // Open the confirm dialog and confirm
    fireEvent.click(screen.getByRole('button', { name: /Kind löschen/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    // Trigger button must be disabled while the delete is in flight
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Kind löschen/i })).toBeDisabled(),
    )

    // Resolve the pending delete and wait for completion
    resolveDelete?.()
    await waitFor(() => {
      expect(deleteChildSpy).toHaveBeenCalledTimes(1)
      expect(onChanged).toHaveBeenCalled()
    })
  })
})
