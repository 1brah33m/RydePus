import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, MapPin, Crosshair, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { CAMPUS_LOCATIONS } from '../../config/locations'
import { perSeatFare } from '../../config/pricing'

import type { Group, Trip } from '../../types'
import { LANDING_KEY } from '../../utils/keys'
import { formatCurrency } from '../../utils/format'
import { Select } from '../../components/ui/Select'
import type { SelectOption } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'

const LOCATION_OPTIONS: SelectOption[] = CAMPUS_LOCATIONS.map((l) => ({ value: l.id, label: l.name }))

function firstName(fullName: string): string {
  return fullName.split(' ')[0]
}

function nameInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Home() {
  const { student } = useAuth()
  const { activeGroup, activeTrip, pendingGroups, joinGroup } = useApp()
  const navigate = useNavigate()

  const [pickupId, setPickupId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  // How many seats this student is travelling for; drives the fare shown and
  // carried into CreateGroup.
  const [seats, setSeats] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LANDING_KEY)
      if (!raw) return
      localStorage.removeItem(LANDING_KEY)
      const s = JSON.parse(raw) as { pickup?: string; destination?: string; seats?: number }
      if (s.pickup && s.destination) {
        const q = new URLSearchParams({ pickup: s.pickup, destination: s.destination })
        if (s.seats) q.set('seats', String(s.seats))
        navigate(`/find?${q.toString()}`)
      }
    } catch {
      // malformed value – ignore
    }
  }, [navigate])

  const handleSearch = () => {
    if (!pickupId || !destinationId) {
      setError('Choose both your pickup point and destination.')
      return
    }
    if (pickupId === destinationId) {
      setError('Pickup and destination must be different.')
      return
    }
    const q = new URLSearchParams({
      pickup: pickupId,
      destination: destinationId,
      seats: String(seats),
    })
    navigate(`/find?${q.toString()}`)
  }

  const handlePoolOpen = async (group: Group) => {
    try {
      const joined = await joinGroup(group.id)
      navigate(`/groups/${joined.id}`)
    } catch {
      navigate(`/groups/${group.id}`)
    }
  }

  const hour = new Date().getHours()

  return (
    <div className="flex min-h-full flex-col gap-6 pb-8 pt-10 lg:pt-8">
      {/* Greeting + avatar */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">Rydepus</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900 dark:text-slate-100">
            {greetingFor(hour)}, {student ? firstName(student.fullName).trim() : 'there'}!
          </h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">Where to today?</p>
        </div>
        <Link
          to="/profile"
          aria-label="Open profile"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-charcoal text-sm font-bold text-brand-400 shadow-md transition hover:scale-105"
        >
          {student ? nameInitials(student.fullName) : 'K'}
        </Link>
      </header>

      {/* Live trip status banner */}
      {(activeGroup || activeTrip) && <LiveTripBanner group={activeGroup} trip={activeTrip} />}

      {/* Where to? booking card */}
      <section aria-label="Book a ride">
        <div className="rounded-3xl border border-ink-200/70 dark:border-slate-800 bg-white dark:bg-[#1E1E1E] p-5 shadow-lg shadow-ink-900/8">
          <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Where to?</h2>

          <div className="mt-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-3 rounded-2xl bg-ink-50 dark:bg-white/5 px-4 py-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:text-brand-300">
                <MapPin aria-hidden className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Pickup</p>
                <Select
                  aria-label="Pickup point"
                  options={LOCATION_OPTIONS}
                  placeholder="Current location"
                  value={pickupId}
                  className="mt-0.5 h-10 border-0 bg-transparent p-0 pr-6 text-sm font-medium text-ink-900 dark:text-slate-100 focus:ring-0"
                  onChange={(e) => {
                    setPickupId(e.target.value)
                    setError(null)
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/15 px-4 py-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                <Crosshair aria-hidden className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Destination</p>
                <Select
                  aria-label="Destination"
                  options={LOCATION_OPTIONS}
                  placeholder="Where to?"
                  value={destinationId}
                  className="mt-0.5 h-10 border-0 bg-transparent p-0 pr-6 text-sm font-medium text-ink-900 dark:text-slate-100 focus:ring-0"
                  onChange={(e) => {
                    setDestinationId(e.target.value)
                    setError(null)
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-slate-400">
              Seats you need
            </p>
            <div className="mt-2 flex gap-2" role="group" aria-label="Number of seats needed">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeats(n)}
                  aria-pressed={seats === n}
                  className={`flex-1 rounded-xl border py-2 text-sm font-bold transition ${
                    seats === n
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {pickupId && destinationId && pickupId !== destinationId && (
              <p className="mt-2 text-xs text-ink-500 dark:text-slate-400">
                {seats} seat{seats > 1 ? 's' : ''} · about{' '}
                <strong className="text-ink-700 dark:text-slate-300">
                  {formatCurrency(perSeatFare(pickupId, destinationId) * seats)}
                </strong>
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-2.5 text-sm text-rose-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSearch}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 py-4 text-base font-bold text-white shadow-lg shadow-brand-500/25 transition hover:from-brand-400 hover:to-brand-500 active:scale-[0.99]"
          >
            Find a Ride
          </button>
        </div>
      </section>

      {/* Exclusive groups & offers */}
      <section aria-label="Exclusive groups and offers">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-ink-900 dark:text-slate-100">Exclusive Groups &amp; Offers</h2>
          <Link to="/groups" className="inline-flex items-center text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
            View all
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>

        <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">Split the fare and get there faster.</p>

        {pendingGroups.length > 0 ? (
          <div className="mt-3.5 flex flex-col gap-3">
            {pendingGroups.map((group) => (
              <PoolOfferCard key={group.id} group={group} onOpen={() => handlePoolOpen(group)} />
            ))}
          </div>
        ) : (
          <div className="mt-3.5 rounded-2xl border border-dashed border-ink-300 bg-white/60 dark:border-slate-700 dark:bg-white/10 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                <Users aria-hidden className="size-5 text-brand-600 dark:text-brand-400" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-800 dark:text-slate-200">No groups waiting yet</p>
                <p className="text-sm text-ink-500 dark:text-slate-400">Start your own group and others can join you.</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function PoolOfferCard({ group, onOpen }: { group: Group; onOpen: () => void }) {
  const occupied = group.seatsFilled
  // Server-priced fare for the whole keke.
  const poolFare = group.fareTotal

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-ink-200/70 dark:border-slate-800 bg-white dark:bg-[#1E1E1E] p-4 text-left shadow-sm transition hover:border-brand-300 dark:hover:border-brand-500 hover:shadow-md"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
        <Users aria-hidden className="size-5 text-brand-600 dark:text-brand-400" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink-900 dark:text-slate-100">
            {group.pickup.name} → {group.destination.name}
          </p>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <Badge tone="teal">Keke Pool</Badge>
          <span className="text-xs text-ink-500 dark:text-slate-400">
            {occupied}/{group.maxSize} seats
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold text-ink-900 dark:text-slate-100">{formatCurrency(poolFare)}</span>
        <span className="block text-[11px] text-ink-400 dark:text-slate-500">per keke</span>
      </span>
      <ChevronRight aria-hidden className="shrink-0 size-4 text-ink-300 dark:text-slate-600" />
    </button>
  )
}

function LiveTripBanner({ group, trip }: { group: Group | null; trip: Trip | null }) {
  const route = trip
    ? `${trip.pickup.name} → ${trip.destination.name}`
    : `${group!.pickup.name} → ${group!.destination.name}`
  const status = trip ? tripStatusLabel(trip.status) : groupStatusLabel(group!.status)
  const href = trip ? `/trips/${trip.id}` : `/groups/${group!.id}`
  const count = group ? `${group.seatsFilled}/${group.maxSize}` : '4/4'
  const progress = progressFor(trip ? trip.status : (group!.status as string))

  return (
    <Link to={href} className="block">
      <div className="relative overflow-hidden rounded-3xl bg-charcoal p-5 text-white shadow-lg shadow-ink-900/20">
        <div className="absolute -right-10 -top-10 size-32 rounded-full bg-brand-500/25 blur-2xl" aria-hidden />
        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-400" />
            </span>
            LIVE
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">{count}</span>
        </div>

        <p className="relative mt-4 truncate text-lg font-bold tracking-tight">{route}</p>

        <div className="relative mt-3 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-brand-400" />
          <span className="h-px flex-1 bg-white/20" />
          <span className="size-1.5 animate-pulse rounded-full bg-brand-300" />
          <span className="h-px flex-1 bg-white/20" />
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-brand-300 opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-brand-300" />
          </span>
        </div>

        <div className="relative mt-3 flex items-center justify-between">
          <span className="text-sm text-white/70">{status}</span>
          <span className="text-[11px] font-semibold text-white/50">{progress}%</span>
        </div>
        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Link>
  )
}

function progressFor(status: string): number {
  if (status === 'SEARCHING_DRIVER') return 80
  if (status === 'FULL') return 60
  if (status === 'DRIVER_ASSIGNED') return 30
  if (status === 'DRIVER_ACCEPTED') return 45
  if (status === 'IN_PROGRESS' || status === 'IN_TRIP') return 70
  return 25
}

function groupStatusLabel(status: string): string {
  switch (status) {
    case 'WAITING':
      return 'Group waiting'
    case 'FULL':
      return 'Group full'
    case 'SEARCHING_DRIVER':
      return 'Finding driver'
    default:
      return 'Active group'
  }
}

function tripStatusLabel(status: string): string {
  switch (status) {
    case 'DRIVER_ASSIGNED':
    case 'DRIVER_ACCEPTED':
      return 'Driver found'
    case 'IN_PROGRESS':
      return 'En Route'
    case 'COMPLETED':
      return 'Trip completed'
    default:
      return 'Active trip'
  }
}