import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Map,
  Navigation,
  Power,
  Truck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import type { Trip } from '../../types'
import { DriverShell } from '../../components/navigation/DriverShell'
import { OnlineToggle } from '../../components/driver/OnlineToggle'
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
  const nextRequest = requests[0]

  return (
    <DriverShell>
      <div className="flex min-h-full flex-col gap-6 pb-28 pt-10 lg:pb-10 lg:pt-8">
        {/* Greeting + status toggle */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-slate-400">Rydepus Driver</p>
            <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 truncate text-sm text-ink-500 dark:text-slate-400">Ready to earn today?</p>
          </div>
          <OnlineToggle online={online} onToggle={() => void handleToggle()} />
        </header>

        {/* Earnings & status */}
        <section aria-label="Today's earnings">
          <div className="rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-slate-400">Earnings</p>
              {online && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-brand-500 dark:bg-brand-400" />
                  Online
                </span>
              )}
            </div>

            <div className="mt-2.5 flex items-end justify-between gap-3">
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(completedTotal)}
                <span className="ml-1.5 text-xs font-medium text-ink-500 dark:text-slate-400">completed</span>
              </p>
              <span
                className={cn(
                  'rounded-lg px-2 py-1 text-xs font-semibold',
                  online
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                    : 'bg-ink-100 text-ink-500 dark:bg-white/5 dark:text-slate-400',
                )}
              >
                {online ? 'Accepting rides' : 'Offline'}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-ink-100 pt-4 dark:border-white/5">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-slate-500">Trips</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold">
                  <CheckCircle2 aria-hidden className="size-4 text-brand-600 dark:text-brand-400" />
                  {history.length} done
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-slate-500">Queue</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold">
                  <Clock3 aria-hidden className="size-4 text-brand-600 dark:text-brand-400" />
                  {requests.length} new
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-slate-500">Rating</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold">
                  <Zap aria-hidden className="size-4 text-brand-600 dark:text-brand-400" />
                  —
                </dd>
              </div>
            </dl>
          </div>
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
          <h2 className="text-base font-bold tracking-tight">Quick actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <QuickActionCard
              icon={Truck}
              title="Vehicle & Permit"
              subtitle={`${profile?.vehicle_plate ?? 'No plate set'} · ${profile?.vehicle_type ?? 'Keke'}`}
              meta="Permit Verified"
              metaClassName="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
            />
            <QuickActionCard
              icon={Wallet}
              title="Earnings Payout"
              subtitle="Payout history"
              meta={`${formatCurrency(completedTotal)} ready`}
              metaClassName="bg-ink-100 text-ink-800 dark:bg-white/5 dark:text-slate-200"
              onClick={() => navigate('/driver/earnings')}
            />
            <QuickActionCard
              icon={Map}
              title="Campus Zone Hotspots"
              subtitle="High-demand pickup map guide"
              className="col-span-2 lg:col-span-1"
            />
          </div>
        </section>

        <p className="pb-2 text-center text-xs text-ink-400 dark:text-slate-500">Rydepus · Campus Shuttle (MVP)</p>
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
    <section
      aria-label="New ride request"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 p-5 text-white shadow-[0_12px_40px_rgba(30,58,138,0.4)]"
    >
      <span aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />

      <div className="relative flex items-center gap-2">
        <span className="relative flex size-3">
          <span aria-hidden className="absolute inline-flex size-full animate-ping rounded-full bg-charcoal/60 opacity-75" />
          <span aria-hidden className="relative inline-flex size-3 rounded-full bg-charcoal" />
        </span>
        <p className="text-xs font-bold uppercase tracking-widest">New Ride Request</p>
      </div>

      <p className="relative mt-3 text-xl font-bold leading-snug">
        {trip.pickup.name}
        <span className="mx-1.5" aria-hidden>→</span>
        {trip.destination.name}
      </p>

      <div className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
        <span className="inline-flex items-center gap-1">
          <Users aria-hidden className="size-4" />
          {trip.passengerCount ?? 1} passenger{trip.passengerCount && trip.passengerCount > 1 ? 's' : ''}
        </span>
        <span aria-hidden className="text-white/60">•</span>
        <span className="inline-flex items-center gap-1">
          <Navigation aria-hidden className="size-4" />
          {formatCurrency(trip.fare)}/seat
        </span>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-white/20 px-3.5 py-2.5 backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider">Total fare</p>
          <p className="text-base font-bold">
            {formatCurrency(trip.fare * (trip.passengerCount ?? 1))}
          </p>
        </div>
        <div className="flex flex-1 gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-charcoal px-5 text-base font-bold text-white shadow-lg transition-transform active:scale-[0.98]"
          >
            Accept Ride
            <ChevronRight aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={onViewRequests}
            className="inline-flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm transition-transform active:scale-[0.98]"
            aria-label="View all requests"
          >
            <BellRing aria-hidden className="size-5" />
          </button>
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
      className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm dark:border-brand-500/30 dark:bg-[#1E1E1E]"
    >
      <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
        <BellRing aria-hidden className="size-4" />
        <p className="text-xs font-bold uppercase tracking-widest">
          {waitingToStart ? 'Ride assigned — waiting to start' : 'Ride in progress'}
        </p>
      </div>
      <p className="mt-3 text-lg font-bold leading-snug">
        {trip.pickup.name}
        <span className="mx-1.5" aria-hidden>→</span>
        {trip.destination.name}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600 dark:bg-white/5 dark:text-slate-300">
        <span>
          {waitingToStart
            ? 'Head to the pickup point and start the ride when you arrive.'
            : 'The ride is active. Mark it complete when you reach the destination.'}
        </span>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold',
            waitingToStart ? 'text-amber-600 dark:text-amber-400' : 'text-brand-600 dark:text-brand-400',
          )}
        >
          <Clock3 aria-hidden className="size-4" />
          {waitingToStart ? 'Assigned' : 'In progress'}
        </span>
      </div>
      {waitingToStart ? (
        <button
          type="button"
          onClick={onStart}
          disabled={busy}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <Navigation aria-hidden className="size-4.5" />
          {busy ? 'Starting…' : 'Start Ride'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onComplete}
          disabled={busy}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden className="size-4.5" />
          {busy ? 'Completing…' : 'Mark Ride Complete'}
        </button>
      )}
    </section>
  )
}

function WaitingCard({ onOpenQueue }: { onOpenQueue: () => void }) {
  return (
    <section aria-label="No requests" className="rounded-3xl border border-ink-200/70 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
        <Map aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-bold">No ride requests right now</h2>
      <p className="mx-auto mt-1.5 max-w-60 text-sm leading-relaxed text-ink-500 dark:text-slate-400">
        New requests appear here as students create groups. Keep an eye on the queue.
      </p>
      <button
        type="button"
        onClick={onOpenQueue}
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-500 px-6 text-sm font-bold text-white transition-transform active:scale-[0.98]"
      >
        <BellRing aria-hidden className="size-4" />
        Open queue
      </button>
    </section>
  )
}

function OfflineCard({ onGoOnline, disabled }: { onGoOnline: () => void; disabled?: boolean }) {
  return (
    <section aria-label="Offline" className="rounded-3xl border border-ink-200/70 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500 dark:bg-white/5 dark:text-slate-400">
        <Power aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-bold">You're offline</h2>
      <p className="mx-auto mt-1.5 max-w-60 text-sm leading-relaxed text-ink-500 dark:text-slate-400">
        You are currently offline. Go online to start receiving campus ride requests.
      </p>
      <button
        type="button"
        onClick={onGoOnline}
        disabled={disabled}
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-500 px-6 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        <Power aria-hidden className="size-4" />
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
  metaClassName,
  className,
  onClick,
}: {
  icon: typeof Truck
  title: string
  subtitle: string
  meta?: string
  metaClassName?: string
  className?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col items-start gap-3 rounded-2xl border border-ink-200/70 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-300 dark:border-slate-800 dark:bg-[#1E1E1E] dark:hover:border-slate-600',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
          <Icon aria-hidden className="size-5" />
        </span>
        <ChevronRight aria-hidden className="size-4 text-ink-300 transition-colors group-hover:text-brand-600 dark:text-slate-600 dark:group-hover:text-brand-400" />
      </div>
      <span>
        <span className="block text-sm font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-500 dark:text-slate-400">{subtitle}</span>
      </span>
      {meta && (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold',
            metaClassName ?? 'bg-ink-100 text-ink-700 dark:bg-white/5 dark:text-slate-300',
          )}
        >
          {meta}
        </span>
      )}
    </button>
  )
}