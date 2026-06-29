export function NumberField({ label, value, onChange, suffix }: {
  label: string; value: number | null; onChange: (n: number | null) => void; suffix?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-neutral-400">{label}{suffix ? ` (${suffix})` : ''}</span>
      <input type="number" inputMode="numeric" value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="min-h-12 rounded-xl bg-neutral-900 px-4 text-lg" />
    </label>
  )
}
