import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notification02Icon, CheckmarkCircle02Icon, ArrowRight01Icon, Clock03Icon, MapsIcon, Navigation01Icon, ShutDownIcon, Wallet01Icon, UserGroupIcon, User02Icon } from 'hugeicons-react'
import { formatCurrency } from '../../utils/format'
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
  const ratingSub =
    profile && profile.rating_count > 0
      ? `${profile.rating_count} review${profile.rating_count === 1 ? '' : 's'}`
      : 'no ratings yet'
  const nextRequest = requests[0]
  const openQueue = () => navigate('/driver/requests')

  return (
    <DriverShell>
      <div className="flex min-h-full flex-col gap-5 pb-28 pt-10 lg:pb-10 lg:pt-8">
        {/* Greeting + status */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Rydepus Driver
            </p>
            <h1 className="mt-1 text-[32px] font-bold leading-[1.05] tracking-tight break-words text-foreground sm:text-4xl">
              Welcome back,
              <br />
              {firstName}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Ready to earn today?</p>
          </div>
          <OnlineToggle online={online} onToggle={() => void handleToggle()} />
        </header>

        {/* Stats */}
        <section aria-label="Driver stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Earned" value={formatCurrency(completedTotal)} sub="from completed trips" />
          <StatCard label="Trips" value={String(history.length)} sub="done" />
          <StatCard label="Queue" value={String(requests.length)} sub="new" />
          <StatCard label="Rating" value={ratingLabel} sub={ratingSub} />
        </section>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          {/* Ride requests */}
          <section aria-label="Ride requests" className="min-w-0 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <h2 className="truncate text-lg font-bold text-foreground">Ride requests</h2>
              <button
                type="button"
                onClick={openQueue}
                className="shrink-0 text-sm font-semibold text-foreground underline underline-offset-4 transition-opacity hover:opacity-70"
              >
                Open queue
              </button>
            </div>
            <div className="mt-4">
              {!online ? (
                <OfflineBox onGoOnline={() => void handleToggle()} going={toggling} />
              ) : activeTrip ? (
                <ActiveBox
                  trip={activeTrip}
                  busy={busy}
                  onStart={() => void start(activeTrip.id)}
                  onComplete={() => void complete(activeTrip.id)}
                />
              ) : nextRequest ? (
                <RequestBox
                  trip={nextRequest}
                  onAccept={() => void accept(nextRequest.id)}
                  onViewRequests={openQueue}
                />
              ) : (
                <EmptyBox onOpenQueue={openQueue} />
              )}
            </div>
          </section>

          {/* Quick actions */}
          <section aria-label="Quick actions" className="min-w-0">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Quick actions
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              <QuickRow
                icon={Notification02Icon}
                title="Requests"
                subtitle="Groups waiting for a driver"
                badge={requests.length > 0 ? `${requests.length} new` : null}
                onClick={openQueue}
              />
              <QuickRow
                icon={Wallet01Icon}
                title="Earnings"
                subtitle="What you have made so far"
                onClick={() => navigate('/driver/earnings')}
              />
              <QuickRow
                icon={User02Icon}
                title="Profile"
                subtitle="Your details and rating"
                onClick={() => navigate('/driver/profile')}
              />
            </div>
          </section>
        </div>

        <p className="pb-2 text-center text-xs text-muted-foreground">Rydepus · Campus Shuttle (MVP)</p>
      </div>
    </DriverShell>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-3xl border border-border bg-card p-5">
      <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-3xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function RequestBox({
  trip,
  onAccept,
  onViewRequests,
}: {
  trip: Trip
  onAccept: () => void
  onViewRequests: () => void
}) {
  return (
    <div className="rounded-2xl bg-muted p-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative flex size-2.5 shrink-0" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
          New ride request
        </p>
      </div>

      <div className="mt-3 flex min-w-0 gap-3">
        <div aria-hidden className="flex shrink-0 flex-col items-center pt-1.5">
          <span className="size-2.5 rounded-full border-2 border-primary" />
          <span className="my-1.5 w-px flex-1 bg-border" />
          <span className="size-2.5 rounded-[4px] bg-foreground" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">From</p>
          <p className="mt-0.5 truncate text-base font-bold text-foreground">{trip.pickup.name}</p>
          <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</p>
          <p className="mt-0.5 truncate text-base font-bold text-foreground">{trip.destination.name}</p>
        </div>
      </div>

      <p className="mt-3 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        <UserGroupIcon aria-hidden className="size-4 shrink-0" />
        <span className="truncate">
          {trip.passengerCount ?? 1} passenger{trip.passengerCount && trip.passengerCount > 1 ? 's' : ''} pooled
        </span>
      </p>

      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total fare</p>
        <p className="truncate text-xl font-bold tabular-nums text-foreground">
          {formatCurrency(trip.fareTotal ?? trip.fare * (trip.passengerCount ?? 1))}
        </p>
      </div>

      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          onClick={onAccept}
          className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-bold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          <span className="truncate">Accept Ride</span>
          <ArrowRight01Icon aria-hidden className="size-5 shrink-0" />
        </button>
        <button
          type="button"
          onClick={onViewRequests}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="View all requests"
        >
          <Notification02Icon aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  )
}

function ActiveBox({
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
    <div className="rounded-2xl bg-muted p-4">
      <div className="flex min-w-0 items-center gap-2 text-primary">
        <Notification02Icon aria-hidden className="size-4 shrink-0" />
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em]">
          {waitingToStart ? 'Ride assigned — waiting to start' : 'Ride in progress'}
        </p>
      </div>
      <p className="mt-3 truncate text-base font-bold leading-snug text-foreground">
        {trip.pickup.name}
        <span className="mx-1.5" aria-hidden>→</span>
        {trip.destination.name}
      </p>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 flex-1 break-words text-sm text-muted-foreground">
          {waitingToStart
            ? 'Head to the pickup point and start the ride when you arrive.'
            : 'The ride is active. Mark it complete when you reach the destination.'}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-primary">
          <Clock03Icon aria-hidden className="size-4 shrink-0" />
          {waitingToStart ? 'Assigned' : 'In progress'}
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-border">
        <PassengerFareList trip={trip} />
      </div>
      {waitingToStart ? (
        <Button size="lg" fullWidth loading={busy} onClick={onStart} className="mt-3 min-w-0">
          <Navigation01Icon aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{busy ? 'Starting…' : 'Start Ride'}</span>
        </Button>
      ) : (
        <Button size="lg" fullWidth loading={busy} onClick={onComplete} className="mt-3 min-w-0">
          <CheckmarkCircle02Icon aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{busy ? 'Completing…' : 'Mark Ride Complete'}</span>
        </Button>
      )}
    </div>
  )
}

function EmptyBox({ onOpenQueue }: { onOpenQueue: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center sm:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <MapsIcon aria-hidden className="size-6" />
      </span>
      <h3 className="mt-4 text-base font-bold text-foreground">No ride requests right now</h3>
      <p className="mx-auto mt-1.5 max-w-60 text-sm leading-relaxed break-words text-muted-foreground">
        New requests appear here as students create groups.
      </p>
      <Button variant="outline" onClick={onOpenQueue} className="mt-5 rounded-full">
        Open queue
      </Button>
    </div>
  )
}

function OfflineBox({ onGoOnline, going }: { onGoOnline: () => void; going: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center sm:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <ShutDownIcon aria-hidden className="size-6" />
      </span>
      <h3 className="mt-4 text-base font-bold text-foreground">You&apos;re offline</h3>
      <p className="mx-auto mt-1.5 max-w-60 text-sm leading-relaxed break-words text-muted-foreground">
        Go online to start receiving campus ride requests.
      </p>
      <Button loading={going} onClick={onGoOnline} className="mt-5 rounded-full">
        Go Online
      </Button>
    </div>
  )
}

function QuickRow({
  icon: Icon,
  title,
  subtitle,
  badge,
  onClick,
}: {
  icon: typeof Wallet01Icon
  title: string
  subtitle: string
  badge?: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-ring"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {badge && (
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-foreground">
          {badge}
        </span>
      )}
      <ArrowRight01Icon aria-hidden className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </button>
  )
}
