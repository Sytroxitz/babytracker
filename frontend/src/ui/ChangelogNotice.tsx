import { useState } from 'react'
import { createPortal } from 'react-dom'
import changelogMarkdown from '../../CHANGELOG.md?raw'
import { changelogKey, latestChangelog } from '../changelog'
import { Button } from './components/Button'

const SEEN_KEY = 'babytracker:seenChangelog'

function lastSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

export function ChangelogNotice({ version, markdown = changelogMarkdown }: { version: string; markdown?: string }) {
  const entry = latestChangelog(markdown)
  const key = entry ? changelogKey(version, entry) : null
  const [seen, setSeen] = useState(lastSeen)
  const open = key !== null && seen !== key

  if (!entry || !open) return null

  function dismiss() {
    if (!key) return
    try {
      localStorage.setItem(SEEN_KEY, key)
    } catch {
      // Keep the dialog usable when browser storage is unavailable.
    }
    setSeen(key)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-white/10 bg-neutral-900 p-5 shadow-2xl">
        <p className="text-xs font-medium text-indigo-300">{version}</p>
        <h2 id="changelog-title" className="mt-1 text-xl font-semibold">Neu in dieser Version</h2>
        <p className="mt-1 text-sm text-neutral-400">{entry.title}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-neutral-200">
          {entry.changes.map((change) => <li key={change}>{change}</li>)}
        </ul>
        <Button autoFocus type="button" className="mt-6 w-full" onClick={dismiss}>
          Verstanden
        </Button>
      </div>
    </div>,
    document.body,
  )
}
