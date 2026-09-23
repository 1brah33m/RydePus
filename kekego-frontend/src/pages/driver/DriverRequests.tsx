import { useEffect, useMemo, useState } from 'react'
import { Flame, Radar, Users } from 'lucide-react'
import { FARE_PER_SEAT, MAX_GROUP_SIZE, CAMPUS_LOCATIONS } from '../../mock/data'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import * as backend from '../../services/mockBackend'
import { dispatchService } from '../../services/dispatchService'
import type { DriverDispatch } from '../../types'
import { DriverShell } from '../../components/navigation/DriverShell'
import { OnlineToggle } from '../../components/driver/OnlineToggle'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

type RequestStatus = 'pending' | 'accepted' | 'declined'

interface RideRequest {
  id: string
  pickup: string
  destination: string
  passengers: number
  status: RequestStatus
}

/** The ride the driver is confirming, or a route that accepts a priority dispatch. */
type EtaTarget = { kind: 'request' | 'dispatch'; id: string } | null

const LOCS = CAMPUS_LOCATIONS

const INITIAL_REQUESTS: RideRequest[] = [
  {
    id: 'rq-1',
    pickup: LOCS[2].name,
    destination: LOCS[4].name,
    passengers: 2,
    status: 'pending',
  },
  {
    id: 'rq-2',
    pickup: LOCS[13].name,
    destination: LOCS[9].name,
    passengers: 3,
    status: 'pending',
  },
]

export function DriverRequests() {
  const [online, setOnline] = useState(true)
  const [requests, setRequests] = useState<RideRequest[]>(INITIAL_REQUESTS)
  const [etaTarget, setEtaTarget] = useState<EtaTarget>(null)
  const [etaMinutes, setEtaMinutes] = useState('8')
  const [acceptedNotice, setAcceptedNotice] = useState<{ pickup: string; destination: string; minutes: number } | null>(null)
  const [dispatches, setDispatches] = useState<DriverDispatch[]>([])

  const pending = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests])

  // Live priority dispatches (fully-funded buyouts) stream into the queue.
  useEffect(() => {
    const loadActive = () => {
      const next = backend.getDispatches().filter((d) => !d.acknowledged)
      setDispatches((prev) =>
        prev.length === next.length && prev.every((p, i) => p.id === next[i]?.id) ? prev : next,
      )
    }
    loadActive()
    const unsubscribe = backend.subscribeDispatches(loadActive)
    const timer = setInterval(loadActive, 5000)
    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [])

  const resolve = (id: string, status: 'accepted' | 'declined') =>
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))

  const resetAll = () => setRequests(INITIAL_REQUESTS)

  /** Open the arrival-time prompt for the ride the driver is accepting. */
  const openEtaPrompt = (target: EtaTarget) => {
    setEtaMinutes('8')
    setEtaTarget(target)
  }

  const ackDispatch = async (dispatchId: string) => {
    await dispatchService.acknowledge(dispatchId)
    setDispatches((prev) => prev.filter((d) => d.id !== dispatchId))
  }

  /** Confirm acceptance with the driver's minutes-to-reach estimate. */
  const confirmAccept = async () => {
    if (!etaTarget) return
    const minutes = Math.max(1, Math.min(60, Number(etaMinutes) || 1))
    if (etaTarget.kind === 'dispatch') {
      const dispatch = dispatches.find((d) => d.id === etaTarget.id)
      await ackDispatch(etaTarget.id)
      setAcceptedNotice({ pickup: dispatch?.pickup.name ?? '', destination: dispatch?.destination.name ?? '', minutes })
    } else {
      const req = requests.find((r) => r.id === etaTarget.id)
      resolve(etaTarget.id, 'accepted')
      setAcceptedNotice({ pickup: req?.pickup ?? '', destination: req?.destination ?? '', minutes })
    }
    setEtaTarget(null)
  }

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
          <OnlineToggle online={online} onToggle={() => setOnline((o) => !o)} />
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
            {pending.length} pending
          </span>
        </div>

        {/* Accepted confirmation */}
        {acceptedNotice && (
          <p
            role="status"
            className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
          >
            Ride accepted — arriving at {acceptedNotice.pickup} in ~{acceptedNotice.minutes} min.
          </p>
        )}

        {/* Fully-funded instant dispatches (student buyouts) */}
        {dispatches.length > 0 && (
          <section aria-label="Priority dispatches">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-brand-500 text-white">
                <Flame aria-hidden className="size-3.5" />
              </span>
              <h2 className="text-sm font-bold tracking-tight">HIGH PRIORITY · READY TO DEPART</h2>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {dispatches.map((dispatch) => (
                <DispatchCard
                  key={dispatch.id}
                  dispatch={dispatch}
                  onAccept={() => openEtaPrompt({ kind: 'dispatch', id: dispatch.id })}
                  onDecline={() => void ackDispatch(dispatch.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Requests list / empty state */}
        {online && pending.length > 0 ? (
          <section aria-label="Request queue" className="grid gap-3 lg:grid-cols-2">
            {pending.map((req) => (
              <RequestCard key={req.id} request={req} onAccept={() => openEtaPrompt({ kind: 'request', id: req.id })} onDecline={() => resolve(req.id, 'declined')} />
            ))}
          </section>
        ) : (
          <EmptyState
            online={online}
            pendingCount={pending.length}
            onGoOnline={() => setOnline(true)}
            onReset={resetAll}
          />
        )}
      </div>

      {/* Arrival-time prompt (no GPS — the driver estimates minutes to pickup) */}
      <Modal open={etaTarget !== null} onClose={() => setEtaTarget(null)} title="Arrival time">
        <p className="text-sm text-ink-600 dark:text-slate-400">
          How many minutes will it take you to reach the pickup?
        </p>
        <div className="mt-4 flex items-end gap-3">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={etaMinutes}
            onChange={(e) => setEtaMinutes(e.target.value)}
            label="Minutes"
            className="text-center text-lg font-bold"
          />
          <span className="pb-3 text-sm text-ink-500 dark:text-slate-400">min</span>
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" fullWidth onClick={() => setEtaTarget(null)}>
            Cancel
          </Button>
          <Button fullWidth onClick={confirmAccept}>
            Accept Request
          </Button>
        </div>
      </Modal>
    </DriverShell>
  )
}

function RequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: RideRequest
  onAccept: () => void
  onDecline: () => void
}) {
  const { pickup, destination, passengers } = request
  return (
    <article
      aria-label={`Request: ${pickup} to ${destination}`}
      className="rounded-2xl border border-ink-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-bold leading-snug">
          {pickup}
          <span className="mx-1.5" aria-hidden>→</span>
          {destination}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-500 dark:bg-brand-400" />
          New
        </span>
      </div>

      <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-ink-500 dark:text-slate-400">
        <Users aria-hidden className="size-4" />
        {passengers}/{MAX_GROUP_SIZE} passengers pooled
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-sm font-bold dark:bg-white/5">
          {formatCurrency(FARE_PER_SEAT)}
          <span className="text-xs font-semibold text-ink-500 dark:text-slate-400">/seat</span>
        </span>
        <button
          type="button"
          onClick={onAccept}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white transition-transform active:scale-[0.98]"
        >
          Accept Request
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-ink-100 px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
        >
          Decline
        </button>
      </div>
    </article>
  )
}

function DispatchCard({
  dispatch,
  onAccept,
  onDecline,
}: {
  dispatch: DriverDispatch
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <article
      aria-label={`Priority ride: ${dispatch.pickup.name} to ${dispatch.destination.name}`}
      className="relative overflow-hidden rounded-2xl border-2 border-brand-500/60 bg-white p-4 shadow-[0_8px_30px_rgba(30,58,138,0.22)] dark:border-brand-400/40 dark:bg-[#1E1E1E]"
    >
      <span aria-hidden className="absolute -right-6 -top-6 size-24 rounded-full bg-brand-500/10 blur-2xl" />

      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-bold leading-snug">
          {dispatch.pickup.name}
          <span className="mx-1.5" aria-hidden>→</span>
          {dispatch.destination.name}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          <Flame aria-hidden className="size-3" />
          Fully funded
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-500 dark:text-slate-400">
        Group <strong className="text-ink-800 dark:text-slate-200">{dispatch.groupCode}</strong> ·{' '}
        {dispatch.seats}/{MAX_GROUP_SIZE} seats · paid &amp; ready
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          {formatCurrency(dispatch.fare)}
        </span>
        <button
          type="button"
          onClick={onAccept}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white transition-transform active:scale-[0.98]"
        >
          Accept Ride
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-ink-100 px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
        >
          Decline
        </button>
      </div>
    </article>
  )
}

function EmptyState({
  online,
  pendingCount,
  onGoOnline,
  onReset,
}: {
  online: boolean
  pendingCount: number
  onGoOnline: () => void
  onReset: () => void
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
      {online && pendingCount === 0 && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-ink-100 px-6 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
        >
          Simulate new request
        </button>
      )}
    </section>
  )
}