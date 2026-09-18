import { ArrowRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { CampusLocation } from '../../types'

interface RouteIndicatorProps {
  pickup: CampusLocation
  destination: CampusLocation
  className?: string
  size?: 'sm' | 'md'
}

export function RouteIndicator({ pickup, destination, className, size = 'md' }: RouteIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-1.5', size === 'sm' ? 'text-xs' : 'text-sm', className)}>
      <span className="truncate font-bold text-ink-900 dark:text-slate-100">{pickup.name}</span>
      <ArrowRight aria-hidden className={cn('shrink-0 text-ink-400 dark:text-slate-500', size === 'sm' ? 'size-3' : 'size-4')} />
      <span className="truncate font-bold text-ink-900 dark:text-slate-100">{destination.name}</span>
    </div>
  )
}