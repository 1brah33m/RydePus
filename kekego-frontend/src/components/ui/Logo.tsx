import { cn } from '../../utils/cn'

interface LogoProps {
  className?: string
  iconOnly?: boolean
  /** Stack the "Ryde"/"pus" wordmark onto two lines instead of one. */
  stacked?: boolean
  /** Dark background-aware variant (used on charcoal screens). */
  tone?: 'dark' | 'light'
}

/**
 * Standalone stylized 'R' mark with a superscript 'p' — the Rydepus brand mark.
 * Rendered as text so it inherits the surrounding font and color system.
 */
export function RMark({
  className,
  tone = 'light',
}: {
  className?: string
  tone?: 'dark' | 'light'
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex select-none font-extrabold leading-none tracking-tighter',
        tone === 'dark' ? 'text-white' : 'text-brand-700',
        className,
      )}
    >
      <span>R</span>
      <span
        className={cn(
          'absolute -top-[0.02em] right-[0.06em] text-[0.42em] font-extrabold leading-none',
          tone === 'dark' ? 'text-brand-300' : 'text-brand-500',
        )}
      >
        p
      </span>
    </span>
  )
}

/** Rydepus stacked wordmark + icon. Branding is centralized here so it is easy to change. */
export function Logo({ className, iconOnly = false, stacked = false, tone = 'light' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 dark:bg-brand-500/25">
        <RMark tone={tone} className="text-lg" />
      </span>
      {!iconOnly &&
        (stacked ? (
          <span
            className={cn(
              'flex flex-col text-xl font-bold leading-[1.05] tracking-tight',
              tone === 'dark' ? 'text-white' : 'text-ink-900',
            )}
          >
            <span>Ryde</span>
            <span className={tone === 'dark' ? 'text-brand-400' : 'text-brand-500'}>pus</span>
          </span>
        ) : (
          <span
            className={cn(
              'text-xl font-bold tracking-tight',
              tone === 'dark' ? 'text-white' : 'text-ink-900',
            )}
          >
            Ryde
            <span className={tone === 'dark' ? 'text-brand-400' : 'text-brand-500'}>pus</span>
          </span>
        ))}
    </div>
  )
}