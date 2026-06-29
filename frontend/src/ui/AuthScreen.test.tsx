import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthScreen } from './AuthScreen'

test('submitting login calls onSignIn with credentials', async () => {
  const onSignIn = vi.fn().mockResolvedValue(undefined)
  render(<AuthScreen onSignIn={onSignIn} onSignUp={vi.fn()} />)
  await userEvent.type(screen.getByLabelText(/e-?mail/i), 'a@b.de')
  await userEvent.type(screen.getByLabelText(/passwort/i), 'secret123')
  await userEvent.click(screen.getByRole('button', { name: /anmelden/i }))
  expect(onSignIn).toHaveBeenCalledWith('a@b.de', 'secret123')
})
