import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  placeholder?: string
  error?: string
}

export function Select({ label, options, placeholder, error, className, id, ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-12 w-full appearance-none rounded-xl border bg-white px-4 pr-10 text-base text-ink-900 transition-shadow',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none',
            'dark:border-slate-700 dark:bg-[#1E1E1E] dark:text-slate-100',
            error ? 'border-rose-300 dark:border-rose-400/60' : 'border-ink-300',
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-400"
        />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}