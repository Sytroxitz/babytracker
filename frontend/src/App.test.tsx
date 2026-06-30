import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import App from './App'
import { db, setMeta } from './db/database'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

test('renders the auth title when signed out', async () => {
  render(<App />)
  expect(await screen.findByText('BabyTracker')).toBeInTheDocument()
})

test('shows onboarding when authed but no children', async () => {
  await setMeta(db, 'token', 't1')
  await db.children.clear()
  render(<App />)
  await waitFor(() => expect(screen.getByText(/Willkommen/)).toBeInTheDocument())
})
