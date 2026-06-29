import type { Side } from '../../types'

export function SideSelect({ value, onChange }: { value: Side | null; onChange: (s: Side) => void }) {
  const opts: [Side, string][] = [['left', 'Links'], ['right', 'Rechts'], ['both', 'Beide']]
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`min-h-12 rounded-xl ${value === v ? 'bg-indigo-600' : 'bg-neutral-800'}`}>{label}</button>
      ))}
    </div>
  )
}
