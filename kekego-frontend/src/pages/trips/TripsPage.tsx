import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { Trip } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TripCard } from '../../components/trips/TripCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { RouteIndicator } from '../../components/shared/RouteIndicator'

export function TripsPage() {
  const { state, activeTrip } = useApp()

  const { active, completed, cancelled, upcoming } = useMemo(() => {
    const root = state.trips
    return {
      active: root.filter((t) => t.status === 'DRIVER_ASSIGNED' || t.status === 'DRIVER_ACCEPTED' || t.status === 'IN_PROGRESS'),
      completed: root
        .filter((t) => t.status === 'COMPLETED')
        .sort((a, b) => new Date(b.completedAt ?? b.requestedAt).getTime() - new Date(a.completedAt ?? a.requestedAt).getTime()),
      cancelled: root
        .filter((t) => t.status === 'CANCELLED')
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()),
      upcoming: [] as Trip[],
    }
  }, [state.trips])

  return (
    <div className="flex min-h-full flex-col gap-5 pb-8 pt-10 lg:pt-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-slate-100">Trips</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">Your ride history.</p>
      </header>

      {activeTrip && (
        <Link to={`/trips/${activeTrip.id}`} className="block">
          <Card className="flex items-center gap-3 border-brand-200 dark:border-brand-500/30 bg-brand-50/70 dark:bg-brand-500/15 p-4 transition-shadow hover:shadow-md">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
              <ArrowRight aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Active trip</p>
              <RouteIndicator pickup={activeTrip.pickup} destination={activeTrip.destination} size="sm" />
            </div>
          </Card>
        </Link>
      )}

      <Section title="Upcoming" icon={CalendarClock}>
        {upcoming.length > 0 ? (
          <TripColumn trips={upcoming} />
        ) : (
          <Card className="p-4 text-sm text-ink-500 dark:text-slate-400">
            Scheduled rides will appear here when the feature ships.
            <span className="mt-1.5 block">
              <Button to="/home" variant="outline" size="sm">Plan a ride</Button>
            </span>
          </Card>
        )}
      </Section>

      <Section title="Active" icon={ArrowRight}>
        {active.length > 0 ? (
          <TripColumn trips={active} />
        ) : (
          <p className="text-sm text-ink-400 dark:text-slate-500">No active trips right now.</p>
        )}
      </Section>

      <Section title="Completed" icon={CheckCircle2}>
        {completed.length > 0 ? (
          <TripColumn trips={completed} />
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="No completed trips"
            description="When you finish a ride, it will show up here."
          />
        )}
      </Section>

      <Section title="Cancelled" icon={XCircle}>
        {cancelled.length > 0 ? (
          <TripColumn trips={cancelled} />
        ) : (
          <p className="text-sm text-ink-400 dark:text-slate-500">No cancelled trips.</p>
        )}
      </Section>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof CheckCircle2
  children: ReactNode
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink-400 dark:text-slate-500">
        <Icon aria-hidden className="size-4" />
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}

function TripColumn({ trips }: { trips: Trip[] }) {
  return (
    <>
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </>
  )
}