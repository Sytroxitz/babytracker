import { useEffect } from 'react'
import { Button } from './Button'

interface Props {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Lightweight modal confirmation (bottom-sheet on mobile, centered card on desktop). */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center animate-fade-in"
    >
      <button
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />
      <div className="relative w-full sm:max-w-sm bg-neutral-900/95 border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 pb-safe shadow-2xl animate-fade-in-up">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-neutral-400 mt-1.5">{description}</p>}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-14 rounded-2xl bg-red-600 text-white text-lg font-semibold transition active:scale-[0.97] hover:bg-red-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
