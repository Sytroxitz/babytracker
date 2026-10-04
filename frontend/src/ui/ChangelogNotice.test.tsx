import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangelogNotice } from './ChangelogNotice'

const markdown = '## Neue Version\n- Größe erfassen.\n'

beforeEach(() => localStorage.clear())

test('shows the latest changes once for each loaded app version', async () => {
  const view = render(<ChangelogNotice version="Version 1" markdown={markdown} />)
  expect(screen.getByRole('dialog', { name: /neu in dieser version/i })).toHaveTextContent('Größe erfassen.')
  await userEvent.click(screen.getByRole('button', { name: 'Verstanden' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  view.unmount()
  render(<ChangelogNotice version="Version 1" markdown={markdown} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  render(<ChangelogNotice version="Version 2" markdown={markdown} />)
  expect(screen.getByRole('dialog', { name: /neu in dieser version/i })).toBeInTheDocument()
})
