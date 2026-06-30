export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`spin inline-block rounded-full border-2 border-current border-r-transparent ${className}`}
      style={{ width: '1.1em', height: '1.1em' }}
    />
  )
}
