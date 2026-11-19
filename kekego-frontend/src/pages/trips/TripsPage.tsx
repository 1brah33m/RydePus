import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight01Icon, Calendar01Icon, CancelCircleIcon, CheckmarkCircle02Icon } from 'hugeicons-react'
import { useApp } from '../../context/AppContext'
import type { Trip } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TripCard } from '../../components/trips/TripCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDayTime } from '../../utils/format'
import { cn } from '../../utils/cn'

type Filter = 'all' | 'active' | 'completed' | 'cancelled'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function TripsPage() {
  const { state, activeTrip } = useApp()
  const [filter, setFilter] = useState<Filter>('all')

  const { active, completed, cancelled } = useMemo(() => {
    const root = state.trips
    return {
      active: root.filter((t) =>
        ['PENDING', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'IN_PROGRESS'].includes(t.status),
      ),
      completed: root
        .filter((t) => t.status === 'COMPLETED')
        .sort((a, b) => new Date(b.completedAt ?? b.requestedAt).getTime() - new Date(a.completedAt ?? a.requestedAt).getTime()),
      cancelled: root
        .filter((t) => t.status === 'CANCELLED')
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
    }
  }, [state.trips])

  const visible: Trip[] =
    filter === 'active' ? active : filter === 'completed' ? completed : filter === 'cancelled' ? cancelled : [...active, ...completed, ...cancelled]

  const total = state.trips.length

  return (
    <div className="flex min-h-full flex-col gap-5 pb-8 pt-10 lg:pt-8">
      {/* Header — count uses tabular numerals from the project mono token */}
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Trips</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your ride history.</p>
        </div>
        <p className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
          {total} {total === 1 ? 'ride' : 'rides'}
        </p>
      </header>

      {/* Active trip hero — the single elevated moment on this screen */}
      {activeTrip && (filter === 'all' || filter === 'active') && (
        <Link
          to={`/trips/${activeTrip.id}`}
          aria-label={`Continue active trip ${activeTrip.code}: ${activeTrip.pickup.name} to ${activeTrip.destination.name}`}
          className="group block rounded-2xl bg-primary p-5 text-primary-foreground shadow-md transition-transform duration-200 hover:scale-[1.005] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.995]"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-current" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider">Active trip</p>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
              <span aria-hidden className="size-1.5 rounded-full bg-white" />
              {activeTrip.status === 'PENDING' ? 'Pending' : activeTrip.status === 'COMPLETED' ? 'Completed' : activeTrip.status === 'CANCELLED' ? 'Cancelled' : activeTrip.status === 'IN_PROGRESS' ? 'On the way' : 'Driver found'}
            </span>
          </div>

          <div className="mt-3 flex gap-3">
            <div aria-hidden className="flex flex-col items-center pt-1.5">
              <span className="size-2.5 rounded-full border-2 border-current" />
              <span className="my-1 w-px flex-1 bg-current opacity-30" />
              <span className="size-2.5 rounded-[4px] bg-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold leading-snug">{activeTrip.pickup.name}</p>
              <p className="mt-0.5 truncate text-lg font-bold leading-snug">{activeTrip.destination.name}</p>
              <p className="mt-2 font-mono text-[13px] tabular-nums opacity-80">
                {formatDayTime(activeTrip.startedAt ?? activeTrip.requestedAt)}
                {activeTrip.driver ? ` · ${activeTrip.driver.name}` : ''} · Trip {activeTrip.code}
              </p>
            </div>
          </div>

          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold">
            View trip
            <ArrowRight01Icon aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      {/* Filter tabs — standard affordance, project tokens only */}
      <div role="tablist" aria-label="Filter trips" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.value === 'active' ? active.length : f.value === 'completed' ? completed.length : f.value === 'cancelled' ? cancelled.length : total
          const selected = filter === f.value
          return (
            <button
              key={f.value}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setFilter(f.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f.label}
              <span className={cn('font-mono text-xs tabular-nums', selected ? 'opacity-80' : 'opacity-60')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* History list */}
      {visible.length > 0 ? (
        <div className="flex flex-col gap-3" role="tabpanel">
          {visible.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : (
        <div role="tabpanel">
          {filter === 'completed' ? (
            <EmptyState
              icon={CheckmarkCircle02Icon}
              title="No completed trips"
              description="When you finish a ride, it will show up here."
              action={<Button to="/home" variant="outline" size="sm">Plan a ride</Button>}
            />
          ) : filter === 'cancelled' ? (
            <EmptyState
              icon={CancelCircleIcon}
              title="No cancelled trips"
              description="Cancelled rides stay out of the way here."
            />
          ) : filter === 'active' ? (
            <EmptyState
              icon={ArrowRight01Icon}
              title="No active trips"
              description="Start a ride and it will appear at the top with live status."
              action={<Button to="/home" variant="outline" size="sm">Find a ride</Button>}
            />
          ) : (
            <EmptyState
              icon={CheckmarkCircle02Icon}
              title="No trips yet"
              description="Your completed and cancelled rides will live here."
              action={<Button to="/home" variant="outline" size="sm">Plan your first ride</Button>}
            />
          )}
        </div>
      )}

      {/* Upcoming — still unshipped, taught as a disabled future, not a dead card */}
      {(filter === 'all' || filter === 'active') && (
        <section aria-label="Upcoming">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <Calendar01Icon aria-hidden className="size-4" />
            Upcoming
          </h2>
          <Card className="border-dashed p-4 text-sm text-muted-foreground">
            Scheduled rides will appear here when the feature ships.
            <span className="mt-2 block">
              <Button to="/home" variant="outline" size="sm">Plan a ride</Button>
            </span>
          </Card>
        </section>
      )}
    </div>
  )
}
