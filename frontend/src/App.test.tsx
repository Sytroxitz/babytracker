import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app title', async () => {
  render(<App />)
  expect(await screen.findByText('BabyTracker')).toBeInTheDocument()
})
