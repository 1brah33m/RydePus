import { ArrowRight01Icon, Clock01Icon } from 'hugeicons-react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../types'
import { formatDayTime } from '../../utils/format'
import { TripStatusBadge } from '../ui/StatusBadge'

interface TripCardProps {
  trip: Trip
}

export function TripCard({ trip }: TripCardProps) {
  return (
    <Link
      to={`/trips/${trip.id}`}
      aria-label={`View trip ${trip.code}: ${trip.pickup.name} to ${trip.destination.name}`}
      className="group block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors duration-200 hover:border-ring hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5"
    >
      <div className="flex gap-3.5">
        {/* Route rail — same language as Home booking hero */}
        <div aria-hidden className="flex flex-col items-center pt-1.5">
          <span className="size-2.5 rounded-full border-2 border-primary" />
          <span className="my-1 w-px flex-1 bg-border" />
          <span className="size-2.5 rounded-[4px] bg-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-snug text-foreground">
                {trip.pickup.name}
              </p>
              <p className="mt-1 truncate text-[15px] font-bold leading-snug text-foreground">
                {trip.destination.name}
              </p>
            </div>
            <TripStatusBadge status={trip.status} className="shrink-0" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Clock01Icon aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate font-mono tabular-nums">
                {formatDayTime(trip.completedAt ?? trip.startedAt ?? trip.requestedAt)}
              </span>
            </span>
            {trip.driver && (
              <span className="min-w-0 truncate">
                Driver: <span className="font-medium text-foreground">{trip.driver.name}</span>
              </span>
            )}
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider tabular-nums">
              Trip {trip.code}
            </span>
          </div>
        </div>

        <span className="flex shrink-0 items-center">
          <span className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 group-hover:bg-muted group-hover:text-foreground">
            <ArrowRight01Icon aria-hidden className="size-4" />
          </span>
        </span>
      </div>
    </Link>
  )
}
