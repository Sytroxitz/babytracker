import type { LogType } from '../types'

/** Shared presentation metadata per log type (label, emoji icon, accent classes). */
export const TYPE_META: Record<
  LogType,
  { label: string; icon: string; tile: string; chip: string }
> = {
  nursing: {
    label: 'Stillen',
    icon: '🤱',
    tile: 'from-rose-500/25 to-rose-500/5 border-rose-400/20',
    chip: 'bg-rose-500/15 text-rose-200',
  },
  pumping: {
    label: 'Pumpen',
    icon: '💧',
    tile: 'from-sky-500/25 to-sky-500/5 border-sky-400/20',
    chip: 'bg-sky-500/15 text-sky-200',
  },
  bottle: {
    label: 'Flasche',
    icon: '🍼',
    tile: 'from-amber-500/25 to-amber-500/5 border-amber-400/20',
    chip: 'bg-amber-500/15 text-amber-200',
  },
  weight: {
    label: 'Gewicht',
    icon: '⚖️',
    tile: 'from-emerald-500/25 to-emerald-500/5 border-emerald-400/20',
    chip: 'bg-emerald-500/15 text-emerald-200',
  },
}

export const TYPE_ORDER: LogType[] = ['nursing', 'pumping', 'bottle', 'weight']

/** Types entered from the "Erfassen" quick-entry screen (weight lives on its own page). */
export const ENTRY_TYPES: LogType[] = ['nursing', 'pumping', 'bottle']
