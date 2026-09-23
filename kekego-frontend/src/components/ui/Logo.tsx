import { Navigation } from 'lucide-react'
import { cn } from '../../utils/cn'

interface LogoProps {
  className?: string
  iconOnly?: boolean
  /** Dark background-aware variant (used on charcoal screens). */
  tone?: 'dark' | 'light'
}

/** Rydepus wordmark + icon. Branding is centralized here so it is easy to change. */
export function Logo({ className, iconOnly = false, tone = 'light' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
        <Navigation aria-hidden className="size-5" />
      </span>
      {!iconOnly && (
        <span
          className={cn(
            'text-xl font-bold tracking-tight',
            tone === 'dark' ? 'text-white' : 'text-ink-900',
          )}
        >
          Ryde
          <span className={tone === 'dark' ? 'text-brand-400' : 'text-brand-600'}>pus</span>
        </span>
      )}
    </div>
  )
}