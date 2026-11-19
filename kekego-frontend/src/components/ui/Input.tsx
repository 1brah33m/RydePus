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
  void tone
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={cn('mb-1.5 block text-sm font-medium text-muted-foreground')}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span
            className={cn(
              'pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted-foreground',
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
            'h-12 w-full rounded-lg border border-border bg-input px-4 text-base text-foreground transition placeholder:text-muted-foreground',
            'focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none',
            leadingIcon ? 'pl-10' : undefined,
            error ? 'border-destructive/60' : 'hover:border-ring/50',
            className,
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} role="alert" className={cn('mt-1.5 animate-ryde-shake text-sm text-destructive')}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className={cn('mt-1.5 text-sm text-muted-foreground')}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}