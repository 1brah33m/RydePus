import { Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Trip } from '../../types'
import { formatDayTime } from '../../utils/format'
import { TripStatusBadge } from '../ui/StatusBadge'

interface TripCardProps {
  trip: Trip
}

export function TripCard({ trip }: TripCardProps) {
  return (
    <Link to={`/trips/${trip.id}`} className="block">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-[#1E1E1E]">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-base font-bold leading-snug text-ink-900 dark:text-slate-100">
            {trip.pickup.name}
          </p>
          <TripStatusBadge status={trip.status} className="shrink-0" />
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold leading-snug text-ink-900 dark:text-slate-100">
          {trip.destination.name}
        </p>

        <div className="mt-3 space-y-2 text-sm text-ink-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock aria-hidden className="size-3.5 text-ink-400 dark:text-slate-500" />
            {formatDayTime(trip.completedAt ?? trip.startedAt ?? trip.requestedAt)}
          </div>
          {trip.driver && (
            <p className="text-ink-500 dark:text-slate-400">Driver: {trip.driver.name}</p>
          )}
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-slate-500">
            Trip {trip.code}
          </p>
        </div>
      </div>
    </Link>
  )
}