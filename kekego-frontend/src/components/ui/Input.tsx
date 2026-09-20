import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leadingIcon?: ReactNode
  /** Dark-field styling for charcoal surfaces. */
  tone?: 'light' | 'dark'
}

export function Input({ label, error, hint, leadingIcon, className, id, tone = 'light', ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            'mb-1.5 block text-sm font-medium',
            tone === 'dark' ? 'text-ink-300' : 'text-ink-700 dark:text-slate-300',
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span
            className={cn(
              'pointer-events-none absolute inset-y-0 left-3.5 flex items-center',
              tone === 'dark' ? 'text-ink-500' : 'text-ink-400',
            )}
          >
            {leadingIcon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full rounded-xl border px-4 text-base transition-shadow',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none',
            leadingIcon ? 'pl-10' : undefined,
            error
              ? tone === 'dark'
                ? 'border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/25'
                : 'border-rose-300 focus:border-rose-400 focus:ring-rose-400/25 dark:border-rose-400/60 dark:focus:border-rose-400 dark:focus:ring-rose-400/25'
              : tone === 'dark'
                ? 'border-white/10 bg-white/[0.07] placeholder:text-ink-500 text-white'
                : 'border-ink-300 bg-white text-ink-900 placeholder:text-ink-400 dark:border-slate-700 dark:bg-[#1E1E1E] dark:text-slate-100 dark:placeholder:text-slate-500',
            className,
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className={cn('mt-1.5 text-sm', tone === 'dark' ? 'text-rose-400' : 'text-rose-600')}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className={cn('mt-1.5 text-sm', tone === 'dark' ? 'text-ink-500' : 'text-ink-500')}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}