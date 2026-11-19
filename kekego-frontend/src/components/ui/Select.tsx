import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ArrowDown01Icon } from 'hugeicons-react'
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
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-12 w-full appearance-none rounded-lg border border-border bg-input px-4 pr-10 text-base text-foreground transition-shadow',
            'focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none',
            error ? 'border-destructive/60' : undefined,
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
        <ArrowDown01Icon
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}