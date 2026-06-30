interface Props {
  onUpdate: () => void
  /** Optional label for the newer build (e.g. "Build 150"). */
  latest: string | null
}

/** Sticky banner shown when a newer app version is available. */
export function UpdateBanner({ onUpdate, latest }: Props) {
  return (
    <button
      onClick={onUpdate}
      className="animate-slide-down sticky top-14 z-10 w-full text-left bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-200 text-sm py-2.5 px-4 hover:bg-emerald-500/20 transition"
    >
      ⬆️ Neue Version verfügbar{latest ? ` (${latest})` : ''} – jetzt aktualisieren.
    </button>
  )
}
