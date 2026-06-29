import type { ButtonHTMLAttributes } from 'react'

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-14 rounded-2xl px-5 text-lg font-medium bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 ${className}`}
    />
  )
}
