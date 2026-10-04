import { expect, test } from 'vitest'
import { allChangelogs, changelogKey, latestChangelog } from './changelog'

const markdown = `# Änderungen

## Neue Version
- Größe erfassen.
- Statistik vergleichen.

## Ältere Version
- Alte Änderung.
`

test('latestChangelog reads only the newest release section', () => {
  expect(latestChangelog(markdown)).toEqual({
    title: 'Neue Version',
    changes: ['Größe erfassen.', 'Statistik vergleichen.'],
  })
})

test('allChangelogs keeps current and older entries in order', () => {
  expect(allChangelogs(markdown)).toEqual([
    { title: 'Neue Version', changes: ['Größe erfassen.', 'Statistik vergleichen.'] },
    { title: 'Ältere Version', changes: ['Alte Änderung.'] },
  ])
})

test('changelogKey changes with the app version or release notes', () => {
  const entry = latestChangelog(markdown)!
  expect(changelogKey('Version 1', entry)).not.toBe(changelogKey('Version 2', entry))
  expect(changelogKey('Version 1', entry)).not.toBe(changelogKey('Version 1', {
    ...entry, changes: ['Andere Änderung.'],
  }))
})
