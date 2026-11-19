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
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/40 shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:bg-secondary/40 shadow-sm',
  outline: 'border border-border bg-background text-foreground hover:border-ring hover:text-foreground',
  ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  danger: 'bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-lg gap-2',
  lg: 'h-13 px-6 text-base rounded-lg gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', to, loading = false, fullWidth = false, className, children, disabled, ...rest },
  ref,
) {
  const classes = cn(
    'btn-press inline-flex items-center justify-center font-semibold transition-colors select-none disabled:pointer-events-none',
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