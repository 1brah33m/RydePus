import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Map,
  Navigation,
  Power,
  Truck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { FARE_PER_SEAT, MAX_GROUP_SIZE, MOCK_DRIVERS, CAMPUS_LOCATIONS } from '../../mock/data'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import * as backend from '../../services/mockBackend'
import type { DriverDispatch } from '../../types'
import { DriverShell } from '../../components/navigation/DriverShell'
import { OnlineToggle } from '../../components/driver/OnlineToggle'

const DRIVER = MOCK_DRIVERS[2]
const REQUEST_PICKUP = CAMPUS_LOCATIONS.find((l) => l.id === 'library') ?? CAMPUS_LOCATIONS[0]
const REQUEST_DESTINATION = CAMPUS_LOCATIONS.find((l) => l.id === 'hostelFemale') ?? CAMPUS_LOCATIONS[0]

export function DriverHome() {
  const navigate = useNavigate()
  const [online, setOnline] = useState(true)
  const [accepted, setAccepted] = useState(false)
  const [dispatches, setDispatches] = useState<DriverDispatch[]>([])

  // Fully-funded buyouts arrive as high-priority dispatches.
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

  return (
    <DriverShell>
      <div className="flex min-h-full flex-col gap-6 pb-28 pt-10 lg:pb-10 lg:pt-8">
        {/* Greeting + status toggle */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-slate-400">Rydepus Driver</p>
            <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight">
              Welcome back, {DRIVER.name.split(' ')[0]}
            </h1>
            <p className="mt-1 truncate text-sm text-ink-500 dark:text-slate-400">Ready to earn today?</p>
          </div>
          <OnlineToggle online={online} onToggle={() => setOnline((o) => !o)} />
        </header>

        {/* Earnings & status */}
        <section aria-label="Today's earnings">
          <div className="rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-slate-400">Today's earnings</p>
              {online && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-brand-500 dark:bg-brand-400" />
                  Online
                </span>
              )}
            </div>

            <div className="mt-2.5 flex items-end justify-between gap-3">
              <p className="text-3xl font-bold tracking-tight">
                {formatCurrency(14500)}
                <span className="ml-1.5 text-xs font-medium text-ink-500 dark:text-slate-400">today</span>
              </p>
              <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                +12% vs last week
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-ink-100 pt-4 dark:border-white/5">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-slate-500">Trips</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold">
                  <CheckCircle2 aria-hidden className="size-4 text-brand-600 dark:text-brand-400" />
                  8 Trips
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-slate-500">Online</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold">
                  <Clock3 aria-hidden className="size-4 text-brand-600 dark:text-brand-400" />
                  3.5h
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-slate-500">Rating</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold">
                  <Zap aria-hidden className="size-4 text-brand-600 dark:text-brand-400" />
                  {DRIVER.rating.toFixed(1)}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Fully-funded buyout dispatch notification */}
        {dispatches.length > 0 && (
          <UrgentDispatchBanner
            count={dispatches.length}
            dispatch={dispatches[0]}
            onOpenQueue={() => navigate('/driver/requests')}
          />
        )}

        {/* Incoming active request / offline placeholder */}
        {online ? (
          accepted ? (
            <AcceptedCard pickup={REQUEST_PICKUP.name} destination={REQUEST_DESTINATION.name} />
          ) : (
            <RideRequestCard
              pickup={REQUEST_PICKUP.name}
              destination={REQUEST_DESTINATION.name}
              farePerSeat={FARE_PER_SEAT}
              onAccept={() => setAccepted(true)}
              onViewRequests={() => navigate('/driver/requests')}
            />
          )
        ) : (
          <OfflineCard onGoOnline={() => setOnline(true)} />
        )}

        {/* Quick actions */}
        <section aria-label="Quick actions">
          <h2 className="text-base font-bold tracking-tight">Quick actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <QuickActionCard
              icon={Truck}
              title="Vehicle & Permit"
              subtitle={`${DRIVER.plateNumber} · ${DRIVER.kekeIdentifier}`}
              meta="Permit Verified"
              metaClassName="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
            />
<QuickActionCard
                icon={Wallet}
                title="Earnings Payout"
                subtitle="Payout history"
                meta="₦38,200 ready"
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

function UrgentDispatchBanner({
  count,
  dispatch,
  onOpenQueue,
}: {
  count: number
  dispatch: DriverDispatch
  onOpenQueue: () => void
}) {
  return (
    <section
      aria-label="Urgent fully-funded ride"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-[0_12px_40px_rgba(30,58,138,0.4)]"
    >
      <span aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/20">
            <Flame aria-hidden className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">Fully-funded ride ready</p>
            <p className="text-xs text-brand-100">
              {count === 1 ? '1 priority dispatch' : `${count} priority dispatches`} · depart now
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenQueue}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-xs font-bold text-brand-700 transition-transform active:scale-[0.98]"
        >
          Open queue
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>

      <p className="relative mt-3 text-lg font-bold leading-snug">
        Group {dispatch.groupCode} — {dispatch.pickup.name}
        <span className="mx-1.5" aria-hidden>→</span>
        {dispatch.destination.name}
      </p>
      <p className="relative mt-1 text-sm text-brand-100">
        {dispatch.seats}/{MAX_GROUP_SIZE} seats · {formatCurrency(dispatch.fare)} fare, paid &amp; ready
      </p>
    </section>
  )
}

function RideRequestCard({
  pickup,
  destination,
  farePerSeat,
  onAccept,
  onViewRequests,
}: {
  pickup: string
  destination: string
  farePerSeat: number
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
        {pickup}
        <span className="mx-1.5" aria-hidden>→</span>
        {destination}
      </p>

      <div className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
        <span className="inline-flex items-center gap-1">
          <Users aria-hidden className="size-4" />
          {MAX_GROUP_SIZE} passengers
        </span>
        <span aria-hidden className="text-white/60">•</span>
        <span className="inline-flex items-center gap-1">
          <Navigation aria-hidden className="size-4" />
          2.4 km away
        </span>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-white/20 px-3.5 py-2.5 backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider">Fare</p>
          <p className="text-base font-bold">
            {formatCurrency(farePerSeat)}
            <span className="text-xs font-semibold">/seat</span>
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

function AcceptedCard({ pickup, destination }: { pickup: string; destination: string }) {
  return (
    <section
      aria-label="Ride accepted"
      className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm dark:border-brand-500/30 dark:bg-[#1E1E1E]"
    >
      <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
        <BellRing aria-hidden className="size-4" />
        <p className="text-xs font-bold uppercase tracking-widest">Ride accepted</p>
      </div>
      <p className="mt-3 text-lg font-bold leading-snug">
        {pickup}
        <span className="mx-1.5" aria-hidden>→</span>
        {destination}
      </p>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink-50 px-4 py-3 dark:bg-white/5">
        <span className="text-sm text-ink-600 dark:text-slate-300">Student is waiting at pickup</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400">
          <Clock3 aria-hidden className="size-4" />
          4 min
        </span>
      </div>
    </section>
  )
}

function OfflineCard({ onGoOnline }: { onGoOnline: () => void }) {
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
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-500 px-6 text-sm font-bold text-white transition-transform active:scale-[0.98]"
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