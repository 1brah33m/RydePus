import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

/** Dark surface input field for charcoal registration screens. */
export function DarkField({
  label,
  error,
  hint,
  trailingIcon,
  className,
  containerClassName,
  ...props
}: {
  label: string
  error?: string
  /** Muted helper text below the field; replaced by the error when present. */
  hint?: string
  trailingIcon?: ReactNode
  containerClassName?: string
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={cn('w-full', containerClassName)}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-help` : undefined}
          className={cn(
            'h-13 w-full rounded-xl bg-white/[0.07] px-4 text-base text-white placeholder:text-ink-500 transition-shadow',
            trailingIcon ? 'pr-11' : undefined,
            'border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none',
            error ? 'border-rose-400/60' : 'border-white/10',
            className,
          )}
          {...props}
        />
        {trailingIcon && (
          <span className="absolute inset-y-0 right-3 flex items-center">{trailingIcon}</span>
        )}
      </div>
      {error ? (
        <p id={`${id}-help`} role="alert" className="mt-1.5 text-sm text-rose-400">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-help`} className="mt-1.5 text-[13px] text-ink-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/** Dark surface select for charcoal registration screens. */
export function DarkSelect({
  label,
  error,
  options,
  placeholder = 'Select',
  className,
  ...props
}: {
  label: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-300">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-13 w-full appearance-none rounded-xl bg-white/[0.07] px-4 text-base text-white transition-shadow',
          'border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none',
          error ? 'border-rose-400/60' : 'border-white/10',
          'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E")] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10',
          className,
        )}
        {...props}
      >
        <option value="" className="bg-charcoal text-ink-400">
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-charcoal text-white">
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-rose-400">
          {error}
        </p>
      )}
    </div>
  )
}