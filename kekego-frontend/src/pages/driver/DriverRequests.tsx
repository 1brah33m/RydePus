import { useState } from 'react'
import { CircleAlert, Radar, Users } from 'lucide-react'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import type { Trip } from '../../types'
import { DriverShell } from '../../components/navigation/DriverShell'
import { OnlineToggle } from '../../components/driver/OnlineToggle'
import { useDriverRide } from '../../hooks/useDriverRide'
import { Button } from '../../components/ui/Button'

export function DriverRequests() {
  const { online, requests, activeTrip, busy, setOnline, accept, start, complete } = useDriverRide()
  const [acceptedNotice, setAcceptedNotice] = useState<{ pickup: string; destination: string } | null>(null)

  const handleAccept = async (trip: Trip) => {
    await accept(trip.id)
    setAcceptedNotice({ pickup: trip.pickup.name, destination: trip.destination.name })
    setTimeout(() => setAcceptedNotice(null), 6000)
  }

  const awaitingStart = activeTrip?.status === 'DRIVER_ACCEPTED'
  const inProgress = activeTrip?.status === 'IN_PROGRESS'

  return (
    <DriverShell>
      <div className="flex min-h-full flex-col gap-6 pb-28 pt-10 lg:pb-10 lg:pt-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-slate-400">Live queue</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight">Incoming Requests</h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">Live queue matching campus riders</p>
          </div>
          <OnlineToggle online={online} onToggle={() => void setOnline(!online)} />
        </header>

        {/* Status line */}
        <div className="flex items-center justify-between rounded-2xl border border-ink-200/70 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
          <span className="inline-flex items-center gap-2 text-sm text-ink-700 dark:text-slate-300">
            <span
              className={cn(
                'size-2 rounded-full',
                online ? 'animate-pulse bg-brand-500' : 'bg-ink-300 dark:bg-slate-600',
              )}
            />
            {online ? 'Matching you with nearby riders' : 'You are offline'}
          </span>
          <span className="text-xs font-semibold text-ink-500 dark:text-slate-400">
            {requests.length} pending
          </span>
        </div>

        {/* Active ride lock — cannot accept another request until this ride completes */}
        {activeTrip && (
          <section
            aria-label="Current ride"
            className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3.5 dark:border-amber-500/30 dark:bg-amber-500/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-bold text-amber-900 dark:text-amber-200">
                  <CircleAlert aria-hidden className="size-4" />
                  {awaitingStart
                    ? 'Finish this ride before accepting another'
                    : 'The ride is in progress'}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-amber-800/90 dark:text-amber-200/90">
                  {activeTrip.pickup.name}
                  <span className="mx-1.5" aria-hidden>→</span>
                  {activeTrip.destination.name}
                </p>
              </div>
              {awaitingStart ? (
                <Button size="sm" loading={busy} onClick={() => void start(activeTrip.id)}>
                  Start Ride
                </Button>
              ) : inProgress ? (
                <Button size="sm" loading={busy} onClick={() => void complete(activeTrip.id)}>
                  Mark Ride Complete
                </Button>
              ) : null}
            </div>
          </section>
        )}

        {/* Accepted confirmation */}
        {acceptedNotice && (
          <p
            role="status"
            className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
          >
            Ride accepted — {acceptedNotice.pickup} → {acceptedNotice.destination}. Head to the pickup to start.
          </p>
        )}

        {/* Requests list / empty state */}
        {online && requests.length > 0 ? (
          <section aria-label="Request queue" className="grid gap-3 lg:grid-cols-2">
            {requests.map((trip) => (
              <RequestCard
                key={trip.id}
                trip={trip}
                disabled={busy || Boolean(activeTrip)}
                onAccept={() => void handleAccept(trip)}
              />
            ))}
          </section>
        ) : (
          <EmptyState
            online={online}
            pendingCount={requests.length}
            onGoOnline={() => void setOnline(true)}
          />
        )}
      </div>
    </DriverShell>
  )
}

function RequestCard({
  trip,
  disabled,
  onAccept,
}: {
  trip: Trip
  disabled?: boolean
  onAccept: () => void
}) {
  const passengers = trip.passengerCount ?? 1
  return (
    <article
      aria-label={`Request: ${trip.pickup.name} to ${trip.destination.name}`}
      className="rounded-2xl border border-ink-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-bold leading-snug">
          {trip.pickup.name}
          <span className="mx-1.5" aria-hidden>→</span>
          {trip.destination.name}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-500 dark:bg-brand-400" />
          New
        </span>
      </div>

      <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-ink-500 dark:text-slate-400">
        <Users aria-hidden className="size-4" />
        {passengers} passenger{passengers > 1 ? 's' : ''} pooled
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-sm font-bold dark:bg-white/5">
          {formatCurrency(trip.fare)}
          <span className="text-xs font-semibold text-ink-500 dark:text-slate-400">/seat</span>
        </span>
        <button
          type="button"
          onClick={onAccept}
          disabled={disabled}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-brand-300 dark:disabled:bg-brand-500/30"
        >
          Accept Request
        </button>
      </div>
    </article>
  )
}

function EmptyState({
  online,
  pendingCount,
  onGoOnline,
}: {
  online: boolean
  pendingCount: number
  onGoOnline: () => void
}) {
  return (
    <section
      aria-label="No incoming requests"
      className="flex flex-col items-center rounded-3xl border border-ink-200/70 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]"
    >
      <div className="relative flex size-20 items-center justify-center">
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand-500/20 dark:bg-brand-500/25" />
        <span aria-hidden className="absolute inset-3 animate-ping rounded-full bg-brand-500/15 [animation-delay:150ms]" />
        <span className="relative flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
          <Radar aria-hidden className="size-6" />
        </span>
      </div>

      <h2 className="mt-5 text-base font-bold tracking-tight">
        {online ? 'No incoming requests' : "You're offline"}
      </h2>
      <p className="mx-auto mt-1.5 max-w-60 text-sm leading-relaxed text-ink-500 dark:text-slate-400">
        {online
          ? pendingCount > 0
            ? 'All requests resolved. New ones appear here as riders match.'
            : 'Looking for nearby campus riders...'
          : 'Go online to start receiving campus ride requests.'}
      </p>

      {!online && (
        <button
          type="button"
          onClick={onGoOnline}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-brand-500 px-6 text-sm font-bold text-white transition-transform active:scale-[0.98]"
        >
          Go Online
        </button>
      )}
    </section>
  )
}