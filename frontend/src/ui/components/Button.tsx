import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-950/50',
  secondary:
    'bg-white/8 text-neutral-100 hover:bg-white/14 active:bg-white/16 border border-white/10',
  ghost: 'bg-transparent text-neutral-300 hover:bg-white/8 active:bg-white/10',
}

export function Button({
  className = '',
  variant = 'primary',
  loading = false,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center gap-2 min-h-14 rounded-2xl px-5 text-lg font-semibold
        transition-[transform,background-color,opacity,box-shadow] duration-150 ease-out
        active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100
        focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30
        ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
