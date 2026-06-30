import type { Side } from '../../types'

export function SideSelect({ value, onChange }: { value: Side | null; onChange: (s: Side) => void }) {
  const opts: [Side, string][] = [
    ['left', 'Links'],
    ['right', 'Rechts'],
    ['both', 'Beide'],
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`min-h-12 rounded-xl text-sm font-medium transition active:scale-[0.97] ${
            value === v
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/30'
              : 'bg-white/5 text-neutral-300 hover:bg-white/10'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
