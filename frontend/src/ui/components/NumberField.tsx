export function NumberField({
  label,
  value,
  onChange,
  suffix,
  step,
}: {
  label: string
  value: number | null
  onChange: (n: number | null) => void
  suffix?: string
  step?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-neutral-300">
        {label}
        {suffix ? <span className="text-neutral-500"> ({suffix})</span> : ''}
      </span>
      <input
        type="number"
        inputMode="numeric"
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="field"
      />
    </label>
  )
}
