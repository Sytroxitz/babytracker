import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AboutPage } from './AboutPage'

const markdown = `# Änderungen
## Neue Funktionen
- Größe erfassen.

## Mehrere Kinder
- Mehrere Kinder verwalten.
`

test('highlights the current release and lets users open older changelogs', async () => {
  const onBack = vi.fn()
  render(<AboutPage version="Version 42" markdown={markdown} onBack={onBack} />)

  expect(screen.getByText('Aktuelle Version')).toBeInTheDocument()
  expect(screen.getByText('Version 42')).toBeInTheDocument()
  expect(screen.getByText('Größe erfassen.')).toBeInTheDocument()
  expect(screen.getByText('Mehrere Kinder')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Mehrere Kinder'))
  expect(screen.getByText('Mehrere Kinder verwalten.')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Zurück zur Statistik' }))
  expect(onBack).toHaveBeenCalledOnce()
})
