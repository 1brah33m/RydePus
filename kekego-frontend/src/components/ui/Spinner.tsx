import { Loading02Icon } from 'hugeicons-react'
import { cn } from '../../utils/cn'

type Size = 'sm' | 'md' | 'lg'

const sizes: Record<Size, string> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
}

export function Spinner({
  size = 'md',
  className,
  label = 'Loading',
}: {
  size?: Size
  className?: string
  label?: string
}) {
  return (
    <span role="status" aria-label={label}>
      <Loading02Icon aria-hidden className={cn('animate-spin', sizes[size], className)} />
    </span>
  )
}