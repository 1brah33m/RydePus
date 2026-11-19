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
  void tone
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex select-none font-extrabold leading-none tracking-tighter',
        'text-foreground',
        className,
      )}
    >
      <span>R</span>
      <span
        className={cn(
          'absolute -top-[0.02em] right-[0.06em] text-[0.42em] font-extrabold leading-none',
          'text-primary',
        )}
      >
        p
      </span>
    </span>
  )
}

/** Rydepus stacked wordmark + icon. Branding is centralized here so it is easy to change. */
export function Logo({ className, iconOnly = false, stacked = false, tone = 'light' }: LogoProps) {
  void tone
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <RMark className="text-lg" />
      </span>
      {!iconOnly &&
        (stacked ? (
          <span
            className={cn(
              'flex flex-col text-xl font-bold leading-[1.05] tracking-tight',
              'text-foreground',
            )}
          >
            <span>Ryde</span>
            <span className="text-primary">pus</span>
          </span>
        ) : (
          <span
            className={cn(
              'text-xl font-bold tracking-tight',
              'text-foreground',
            )}
          >
            Ryde
            <span className="text-primary">pus</span>
          </span>
        ))}
    </div>
  )
}