import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Renders the button as a react-router Link when set. */
  to?: string
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300 shadow-sm dark:bg-brand-500 dark:hover:bg-brand-400',
  secondary: 'bg-ink-900 text-white hover:bg-ink-800 disabled:bg-ink-400 shadow-sm dark:bg-ink-200 dark:text-ink-900 dark:hover:bg-white dark:disabled:bg-ink-700',
  outline: 'border border-ink-300 bg-white text-ink-800 hover:border-brand-500 hover:text-brand-700 dark:border-slate-700 dark:bg-[#1E1E1E] dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-brand-300',
  ghost: 'text-ink-700 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-white/10',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-400/30 dark:hover:bg-rose-500/20',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-13 px-6 text-base rounded-xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', to, loading = false, fullWidth = false, className, children, disabled, ...rest },
  ref,
) {
  const classes = cn(
    'inline-flex items-center justify-center font-semibold transition-colors select-none disabled:pointer-events-none',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes} aria-disabled={disabled || loading}>
        {children}
      </Link>
    )
  }

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...rest}>
      {loading && <Spinner size="sm" className="text-current" />}
      {children}
    </button>
  )
})