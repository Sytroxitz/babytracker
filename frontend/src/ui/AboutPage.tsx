import changelogMarkdown from '../../CHANGELOG.md?raw'
import { allChangelogs } from '../changelog'

export function AboutPage({ version, onBack, markdown = changelogMarkdown }: {
  version: string
  onBack: () => void
  markdown?: string
}) {
  const [current, ...older] = allChangelogs(markdown)

  return (
    <div className="p-4 max-w-md mx-auto flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Zurück zur Statistik"
          className="h-10 w-10 grid place-items-center rounded-xl bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30"
        >
          ‹
        </button>
        <h2 className="text-xl font-semibold">Über die App</h2>
      </div>

      <section className="rounded-2xl border border-indigo-400/35 bg-indigo-500/10 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-indigo-500 px-2.5 py-1 text-xs font-semibold text-white">Aktuelle Version</span>
          <span className="text-xs text-neutral-300">{version}</span>
        </div>
        <h3 className="mt-4 text-lg font-semibold">{current?.title ?? 'Änderungen'}</h3>
        {current ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-200">
            {current.changes.map((change) => <li key={change}>{change}</li>)}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-400">Für diese Version sind noch keine Änderungen eingetragen.</p>
        )}
      </section>

      <section aria-label="Ältere Changelogs">
        <h3 className="mb-2 text-sm font-medium text-neutral-300">Frühere Änderungen</h3>
        {older.length === 0 ? (
          <p className="text-sm text-neutral-500">Noch keine älteren Einträge vorhanden.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {older.map((entry) => (
              <details key={entry.title} className="card rounded-2xl px-4 py-3 group">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-medium text-neutral-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 rounded-lg">
                  <span>{entry.title}</span>
                  <span aria-hidden="true" className="text-neutral-500 group-open:rotate-90 transition-transform">›</span>
                </summary>
                <ul className="mt-3 border-t border-white/10 pt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-400">
                  {entry.changes.map((change) => <li key={change}>{change}</li>)}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
