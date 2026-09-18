import { Star } from 'lucide-react'
import { cn } from '../../utils/cn'

interface RatingStarsProps {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizeClasses = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
}

export function RatingStars({ value, onChange, size = 'md', label = 'Rating' }: RatingStarsProps) {
  const interactive = Boolean(onChange)

  return (
    <div
      role={interactive ? 'radiogroup' : undefined}
      aria-label={label}
      className={cn('flex items-center gap-1', interactive ? 'justify-center' : '')}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          role={interactive ? 'radio' : undefined}
          aria-checked={interactive ? n === value : undefined}
          aria-label={`${n} star${n > 1 ? 's' : ''}${interactive ? '' : ` out of 5`}`}
          onClick={() => onChange?.(n)}
          className={cn(
            'rounded-md p-0.5',
            interactive && 'cursor-pointer transition-transform hover:scale-110 focus-visible:-outline-offset-2',
            sizeClasses[size],
          )}
        >
          <Star
            aria-hidden
            className={cn('size-full', sizeClasses[size])}
            fill={n <= Math.round(value) ? 'currentColor' : 'none'}
            strokeWidth={1.6}
            color={n <= Math.round(value) ? 'var(--color-keke-500)' : 'var(--color-ink-300)'}
          />
        </button>
      ))}
    </div>
  )
}