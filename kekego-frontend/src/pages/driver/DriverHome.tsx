import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification02Icon, CheckmarkCircle02Icon, ArrowRight01Icon, Clock03Icon, MapsIcon, Navigation01Icon, ShutDownIcon, StarIcon, TruckIcon, UserGroupIcon, Wallet01Icon } from 'hugeicons-react'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import type { Trip } from '../../types'
import { DriverShell } from '../../components/navigation/DriverShell'
import { OnlineToggle } from '../../components/driver/OnlineToggle'
import { PassengerFareList } from '../../components/driver/PassengerFareList'
import { Button } from '../../components/ui/Button'
import { useDriverRide } from '../../hooks/useDriverRide'

export function DriverHome() {
  const navigate = useNavigate()
  const {
    profile,
    online,
    requests,
    activeTrip,
    busy,
    completedTotal,
    history,
    setOnline,
    accept,
    start,
    complete,
  } = useDriverRide()

  const [toggling, setToggling] = useState(false)

  const handleToggle = async () => {
    setToggling(true)
    try {
      await setOnline(!online)
    } finally {
      setToggling(false)
    }
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Driver'
  const ratingLabel = profile?.rating != null ? profile.rating.toFixed(1) : 'New'
  const nextRequest = requests[0]

  return (
    <DriverShell>
      <div className="flex min-h-full flex-col gap-5 pb-28 pt-10 lg:pb-10 lg:pt-8">
        {/* Greeting + status toggle — same pattern as the student Home */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Rydepus Driver
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">Ready to earn today?</p>
          </div>
          <OnlineToggle online={online} onToggle={() => void handleToggle()} />
        </header>

        {/* Earnings & status */}
        <section aria-label="Today's earnings" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Earnings</p>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold',
                online ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'size-1.5 rounded-full',
                  online ? 'animate-pulse bg-primary' : 'bg-muted-foreground/50',
                )}
              />
              <span className="whitespace-nowrap">{online ? 'Online' : 'Offline'}</span>
            </span>
          </div>

          <div className="mt-2.5 flex min-w-0 items-end justify-between gap-3">
            <p className="min-w-0 truncate text-3xl font-bold tracking-tight tabular-nums text-foreground">
              {formatCurrency(completedTotal)}
              <span className="ml-1.5 text-xs font-medium text-muted-foreground">completed</span>
            </p>
            <span
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap',
                online ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {online ? 'Accepting rides' : 'Paused'}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-4">
            <div className="min-w-0">
              <dt className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Trips</dt>
              <dd className="mt-1.5 flex items-center gap-1.5 text-lg font-bold text-foreground">
                <CheckmarkCircle02Icon aria-hidden className="size-4 shrink-0 text-primary" />
                <span className="truncate tabular-nums">{history.length} done</span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Queue</dt>
              <dd className="mt-1.5 flex items-center gap-1.5 text-lg font-bold text-foreground">
                <Clock03Icon aria-hidden className="size-4 shrink-0 text-primary" />
                <span className="truncate tabular-nums">{requests.length} new</span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rating</dt>
              <dd className="mt-1.5 flex items-center gap-1.5 text-lg font-bold text-foreground">
                <StarIcon aria-hidden className="size-4 shrink-0 fill-amber-400 text-amber-400" />
                <span className="truncate tabular-nums">{ratingLabel}</span>
              </dd>
            </div>
          </dl>
        </section>

        {/* Incoming request / active ride / offline placeholder */}
        {online ? (
          activeTrip ? (
            <ActiveRideCard
              trip={activeTrip}
              busy={busy}
              onStart={() => void start(activeTrip.id)}
              onComplete={() => void complete(activeTrip.id)}
            />
          ) : nextRequest ? (
            <RideRequestCard
              trip={nextRequest}
              onAccept={() => void accept(nextRequest.id)}
              onViewRequests={() => navigate('/driver/requests')}
            />
          ) : (
            <WaitingCard onOpenQueue={() => navigate('/driver/requests')} />
          )
        ) : (
          <OfflineCard onGoOnline={() => void handleToggle()} disabled={toggling} />
        )}

        {/* Quick actions */}
        <section aria-label="Quick actions">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Quick actions</h2>
              <p className="mt-1 text-sm text-muted-foreground">Vehicle, payouts and zones.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            <QuickActionCard
              icon={TruckIcon}
              title="Vehicle & Permit"
              subtitle={`${profile?.vehicle_plate || 'No plate set'} · ${profile?.vehicle_type || 'Keke'}`}
              meta="Permit Verified"
            />
            <QuickActionCard
              icon={Wallet01Icon}
              title="Earnings Payout"
              subtitle="Payout history"
              meta={`${formatCurrency(completedTotal)} ready`}
              onClick={() => navigate('/driver/earnings')}
            />
            <QuickActionCard
              icon={MapsIcon}
              title="Campus Zone Hotspots"
              subtitle="High-demand pickup map guide"
              className="col-span-2 lg:col-span-1"
            />
          </div>
        </section>

        <p className="pb-2 text-center text-xs text-muted-foreground">Rydepus · Campus Shuttle (MVP)</p>
      </div>
    </DriverShell>
  )
}

function RideRequestCard({
  trip,
  onAccept,
  onViewRequests,
}: {
  trip: Trip
  onAccept: () => void
  onViewRequests: () => void
}) {
  return (
    <section aria-label="New ride request" className="overflow-hidden rounded-3xl bg-primary text-primary-foreground">
      <div className="p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex size-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary-foreground" />
          </span>
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em]">New ride request</p>
        </div>

        <div className="mt-4 flex min-w-0 gap-3">
          <div aria-hidden className="flex shrink-0 flex-col items-center pt-1.5">
            <span className="size-2.5 rounded-full border-2 border-primary-foreground" />
            <span className="my-1.5 w-px flex-1 bg-primary-foreground/30" />
            <span className="size-2.5 rounded-[4px] bg-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">From</p>
            <p className="mt-0.5 truncate text-lg font-bold">{trip.pickup.name}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider opacity-70">To</p>
            <p className="mt-0.5 truncate text-lg font-bold">{trip.destination.name}</p>
          </div>
        </div>

        <p className="mt-4 flex min-w-0 items-center gap-1.5 text-sm font-medium opacity-80">
          <UserGroupIcon aria-hidden className="size-4 shrink-0" />
          <span className="truncate">
            {trip.passengerCount ?? 1} passenger{trip.passengerCount && trip.passengerCount > 1 ? 's' : ''} pooled
          </span>
        </p>

        <div className="mt-4 rounded-2xl bg-primary-foreground/10 p-4 ring-1 ring-primary-foreground/15">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Total fare</p>
            <p className="truncate text-xl font-bold tabular-nums">
              {formatCurrency(trip.fareTotal ?? trip.fare * (trip.passengerCount ?? 1))}
            </p>
          </div>
          <div className="mt-3 flex gap-2.5">
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-foreground px-5 text-base font-bold text-primary transition-transform active:scale-[0.98]"
            >
              <span className="truncate">Accept Ride</span>
              <ArrowRight01Icon aria-hidden className="size-5 shrink-0" />
            </button>
            <button
              type="button"
              onClick={onViewRequests}
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 text-primary-foreground ring-1 ring-primary-foreground/15 transition-transform active:scale-[0.98]"
              aria-label="View all requests"
            >
              <Notification02Icon aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function ActiveRideCard({
  trip,
  busy,
  onStart,
  onComplete,
}: {
  trip: Trip
  busy: boolean
  onStart: () => void
  onComplete: () => void
}) {
  const waitingToStart = trip.status === 'DRIVER_ACCEPTED'
  return (
    <section
      aria-label={waitingToStart ? 'Assigned ride' : 'Ride in progress'}
      className="rounded-3xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex min-w-0 items-center gap-2 text-primary">
        <Notification02Icon aria-hidden className="size-4 shrink-0" />
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em]">
          {waitingToStart ? 'Ride assigned — waiting to start' : 'Ride in progress'}
        </p>
      </div>
      <p className="mt-3 truncate text-lg font-bold leading-snug text-foreground">
        {trip.pickup.name}
        <span className="mx-1.5" aria-hidden>→</span>
        {trip.destination.name}
      </p>
      <div className="mt-4 flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        <span className="min-w-0 flex-1 break-words">
          {waitingToStart
            ? 'Head to the pickup point and start the ride when you arrive.'
            : 'The ride is active. Mark it complete when you reach the destination.'}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-primary">
          <Clock03Icon aria-hidden className="size-4 shrink-0" />
          {waitingToStart ? 'Assigned' : 'In progress'}
        </span>
      </div>
      <PassengerFareList trip={trip} className="mt-3" />
      {waitingToStart ? (
        <Button size="lg" fullWidth loading={busy} onClick={onStart} className="mt-4 min-w-0">
          <Navigation01Icon aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{busy ? 'Starting…' : 'Start Ride'}</span>
        </Button>
      ) : (
        <Button size="lg" fullWidth loading={busy} onClick={onComplete} className="mt-4 min-w-0">
          <CheckmarkCircle02Icon aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{busy ? 'Completing…' : 'Mark Ride Complete'}</span>
        </Button>
      )}
    </section>
  )
}

function WaitingCard({ onOpenQueue }: { onOpenQueue: () => void }) {
  return (
    <section aria-label="No requests" className="rounded-3xl border border-border bg-card p-6 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <MapsIcon aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-bold text-foreground">No ride requests right now</h2>
      <p className="mx-auto mt-1.5 max-w-60 text-sm leading-relaxed break-words text-muted-foreground">
        New requests appear here as students create groups. Keep an eye on the queue.
      </p>
      <button
        type="button"
        onClick={onOpenQueue}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        <Notification02Icon aria-hidden className="size-4 shrink-0" />
        Open queue
      </button>
    </section>
  )
}

function OfflineCard({ onGoOnline, disabled }: { onGoOnline: () => void; disabled?: boolean }) {
  return (
    <section aria-label="Offline" className="rounded-3xl border border-border bg-card p-6 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <ShutDownIcon aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-bold text-foreground">You&apos;re offline</h2>
      <p className="mx-auto mt-1.5 max-w-60 text-sm leading-relaxed break-words text-muted-foreground">
        You are currently offline. Go online to start receiving campus ride requests.
      </p>
      <button
        type="button"
        onClick={onGoOnline}
        disabled={disabled}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        <ShutDownIcon aria-hidden className="size-4 shrink-0" />
        Go Online
      </button>
    </section>
  )
}

function QuickActionCard({
  icon: Icon,
  title,
  subtitle,
  meta,
  className,
  onClick,
}: {
  icon: typeof TruckIcon
  title: string
  subtitle: string
  meta?: string
  className?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-w-0 flex-col items-start gap-3 rounded-3xl border border-border bg-card p-4 text-left transition-colors hover:border-ring',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-5" />
        </span>
        <ArrowRight01Icon aria-hidden className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
      </div>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {meta && (
        <span className="inline-flex max-w-full items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-foreground">
          <span className="truncate">{meta}</span>
        </span>
      )}
    </button>
  )
}
