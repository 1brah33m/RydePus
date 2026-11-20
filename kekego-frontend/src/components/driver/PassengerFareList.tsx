import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import type { Trip } from '../../types'

/**
 * Per-passenger fare allocation for a ride.
 *
 * Each row is a member's committed seats (their own plus any they bought out)
 * times the per-seat fare. The student's "Pay your fare" card renders the same
 * figure for themselves, so the two sides always agree on what is owed.
 */
export function PassengerFareList({
  trip,
  onBrand = false,
  className,
}: {
  trip: Trip
  onBrand?: boolean
  className?: string
}) {
  const passengers = trip.passengers ?? []
  if (passengers.length === 0) return null
  const total = passengers.reduce((sum, p) => sum + p.seats * trip.fare, 0)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl',
        onBrand ? 'bg-white/15' : 'bg-muted',
        className,
      )}
    >
      <p
        className={cn(
          'px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider',
          onBrand ? 'text-white/80' : 'text-muted-foreground',
        )}
      >
        Passengers &amp; fare
      </p>
      <ul className={cn('divide-y', onBrand ? 'divide-white/15' : 'divide-border')}>
        {passengers.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
            <span
              className={cn(
                'min-w-0 truncate font-medium',
                onBrand ? 'text-white' : 'text-foreground',
              )}
            >
              {p.name}
            </span>
            <span
              className={cn(
                'shrink-0 whitespace-nowrap tabular-nums',
                onBrand ? 'text-white/90' : 'text-muted-foreground',
              )}
            >
              {p.seats} seat{p.seats > 1 ? 's' : ''} · <strong>{formatCurrency(p.seats * trip.fare)}</strong>
            </span>
          </li>
        ))}
      </ul>
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-t px-3.5 py-2 text-sm font-bold',
          onBrand ? 'border-white/15 text-white' : 'border-border text-foreground',
        )}
      >
        <span>Total fare</span>
        <span className="tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
