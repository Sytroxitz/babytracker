export interface ChangelogEntry {
  title: string
  changes: string[]
}

/** All release notes, newest first as written in the Markdown source. */
export function allChangelogs(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let current: ChangelogEntry | null = null
  for (const line of markdown.split(/\r?\n/)) {
    if (/^##\s+/.test(line)) {
      current = { title: line.replace(/^##\s+/, '').trim(), changes: [] }
      if (current.title) entries.push(current)
      continue
    }
    const match = line.match(/^\s*-\s+(.+)$/)
    if (current && match) current.changes.push(match[1].trim())
  }
  return entries.filter((entry) => entry.changes.length > 0)
}

/** The first section is the release note shown automatically after an update. */
export function latestChangelog(markdown: string): ChangelogEntry | null {
  return allChangelogs(markdown)[0] ?? null
}

/** Include content so local development shows edited notes even before a new build number exists. */
export function changelogKey(version: string, entry: ChangelogEntry): string {
  return JSON.stringify([version, entry.title, entry.changes])
}
