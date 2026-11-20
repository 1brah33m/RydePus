import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight01Icon, ArrowUpDownIcon, UserGroupIcon } from 'hugeicons-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useGroupJoin } from '../../hooks/useGroupJoin'
import { initials } from '../../utils/nameInitials'
import { CAMPUS_LOCATIONS } from '../../config/locations'
import { perSeatFare } from '../../config/pricing'

import type { Group } from '../../types'
import { LANDING_KEY } from '../../utils/keys'
import { formatCurrency } from '../../utils/format'
import { LocationDropdown } from '../../components/ui/LocationDropdown'
import { Alert } from '../../components/ui/Alert'
import { MembershipBlockModal } from '../../components/groups/MembershipBlockModal'
import type { SelectOption } from '../../components/ui/Select'
import { cn } from '../../utils/cn'

const LOCATION_OPTIONS: SelectOption[] = CAMPUS_LOCATIONS.map((l) => ({ value: l.id, label: l.name }))

const POPULAR_IDS = ['main-gate', 'lecture-theatre', 'soa', 'EVM']

function firstName(fullName: string): string {
  return fullName.split(' ')[0]
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Home() {
  const { student } = useAuth()
  const { pendingGroups, activeGroup } = useApp()
  const {
    joiningId,
    blockedGroupId,
    leaving,
    leaveBlocked,
    joinError,
    join,
    dismissBlock,
    viewActiveGroup,
    leaveAndJoin,
    dismissLeaveBlock,
    dismissJoinError,
  } = useGroupJoin()
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

  const handleSwap = () => {
    setPickupId(destinationId)
    setDestinationId(pickupId)
    setError(null)
  }

  const handlePopular = (id: string) => {
    setDestinationId(id)
    setError(null)
  }

  const handlePoolOpen = async (group: Group) => {
    // Route through the shared join guard so "already in a group" opens the
    // membership modal and failures surface as an error instead of silently
    // landing on the detail page.
    await join(group.id)
  }

  const hour = new Date().getHours()
  const canSearch = Boolean(pickupId && destinationId && pickupId !== destinationId)
  const fullName = student?.fullName?.trim() || ''
  const nameParts = fullName.split(/\s+/).filter(Boolean)
  const avatarInitials = fullName
    ? initials(nameParts[0] ?? '', nameParts.slice(1).join(' ')) || 'S'
    : 'S'

  return (
    <div className="flex min-h-full flex-col gap-6 pb-8 pt-10 lg:pt-8">
      {/* Greeting */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {greetingFor(hour)}, {student ? firstName(student.fullName).trim() : 'there'}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Where to today?</p>
        </div>
        <Link
          to="/profile"
          aria-label="View profile"
          title="View profile"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
        >
          <span aria-hidden>{avatarInitials}</span>
        </Link>
      </header>

      {/* Booking hero */}
      <section aria-label="Book a ride">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            {/* Left: route fields */}
            <div className="min-w-0">
              <div className="flex gap-3">
                {/* Route rail */}
                <div aria-hidden className="flex flex-col items-center pt-5">
                  <span className="size-2.5 rounded-full border-2 border-primary" />
                  <span className="my-1 w-px flex-1 bg-border" />
                  <span className="size-2.5 rounded-[4px] bg-foreground" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-muted px-4 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Pickup
                    </p>
                    <LocationDropdown
                      ariaLabel="Pickup point"
                      placeholder="Current location"
                      options={LOCATION_OPTIONS}
                      value={pickupId}
                      onChange={(v) => {
                        setPickupId(v)
                        setError(null)
                      }}
                    />
                  </div>

                  <div className="mt-2.5 rounded-2xl border border-border bg-card px-4 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Destination
                    </p>
                    <LocationDropdown
                      ariaLabel="Destination"
                      placeholder="Search a place on campus"
                      options={LOCATION_OPTIONS}
                      value={destinationId}
                      onChange={(v) => {
                        setDestinationId(v)
                        setError(null)
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={handleSwap}
                    aria-label="Swap pickup and destination"
                    title="Swap pickup and destination"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <ArrowUpDownIcon aria-hidden className="size-4.5" />
                  </button>
                </div>
              </div>

              {/* Popular destinations */}
              <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
                <span className="mr-1 shrink-0 text-sm text-muted-foreground">Popular</span>
                {POPULAR_IDS.map((id) => {
                  const loc = CAMPUS_LOCATIONS.find((l) => l.id === id)
                  if (!loc) return null
                  const active = destinationId === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handlePopular(id)}
                      aria-pressed={active}
                      className={cn(
                        'min-w-0 max-w-full rounded-full border px-3 py-1.5 text-left text-sm font-semibold break-words whitespace-normal transition-colors sm:px-3.5 sm:py-2',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      {loc.name}
                    </button>
                  )
                })}
              </div>

              {error && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            {/* Right: seats + CTA */}
            <div className="min-w-0 rounded-2xl bg-muted p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Seats you need
                </p>
                <p className="text-xs text-muted-foreground">Max 4</p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="Number of seats needed">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSeats(n)}
                    aria-pressed={seats === n}
                    className={cn(
                      'rounded-xl border py-2.5 text-sm font-bold transition-[border-color] active:scale-[0.97]',
                      seats === n
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:border-foreground/40',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {canSearch && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {seats} seat{seats > 1 ? 's' : ''} · about{' '}
                  <strong className="text-foreground">
                    {formatCurrency(perSeatFare(pickupId, destinationId) * seats)}
                  </strong>
                </p>
              )}

              <button
                type="button"
                onClick={handleSearch}
                disabled={!canSearch}
                className={cn(
                  'mt-4 flex w-full items-center justify-center rounded-2xl py-3.5 text-sm font-bold transition-colors',
                  canSearch
                    ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99]'
                    : 'cursor-not-allowed bg-accent text-muted-foreground',
                )}
              >
                {canSearch ? 'Find a Ride' : 'Choose a destination'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Exclusive groups & offers */}
      <section aria-label="Exclusive groups and offers">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Exclusive groups &amp; offers</h2>
            <p className="mt-1 text-sm text-muted-foreground">Split the fare and get there faster.</p>
          </div>
          <Link
            to="/groups"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-foreground hover:underline"
          >
            View all
            <ArrowRight01Icon aria-hidden className="size-4" />
          </Link>
        </div>

        {pendingGroups.length > 0 ? (
          <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
            {pendingGroups.map((group) => (
              <PoolOfferCard
                key={group.id}
                group={group}
                joining={joiningId === group.id}
                onOpen={() => handlePoolOpen(group)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <UserGroupIcon aria-hidden className="size-5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">No groups waiting yet</p>
                <p className="text-sm text-muted-foreground">Start your own group and others can join you.</p>
              </div>
            </div>
          </div>
        )}
        {joinError && (
          <Alert tone="error" className="mt-4">
            <div className="flex items-start justify-between gap-3">
              <span>{joinError}</span>
              <button type="button" onClick={dismissJoinError} className="shrink-0 font-semibold underline">
                Dismiss
              </button>
            </div>
          </Alert>
        )}
      </section>
      <MembershipBlockModal
        open={blockedGroupId !== null}
        code={activeGroup?.code ?? ''}
        leaving={leaving}
        warning={leaveBlocked ? 'A driver is already assigned to this trip. You cannot leave the group now.' : null}
        onClose={() => {
          dismissBlock()
          dismissLeaveBlock()
        }}
        onViewGroup={viewActiveGroup}
        onLeaveGroup={leaveAndJoin}
      />
    </div>
  )
}

function PoolOfferCard({ group, joining, onOpen }: { group: Group; joining?: boolean; onOpen: () => void }) {
  const occupied = group.seatsFilled
  // Server-priced fare for the whole keke.
  const poolFare = group.fareTotal

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-ring">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <div aria-hidden className="flex shrink-0 flex-col items-center pt-1.5">
            <span className="size-2 rounded-full border-2 border-primary" />
            <span className="my-1 w-px flex-1 bg-border" />
            <span className="size-2 rounded-[3px] bg-foreground" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-sm font-bold text-foreground">{group.pickup.name}</p>
            <p className="mt-2 truncate text-sm font-bold text-foreground">{group.destination.name}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold tracking-tight whitespace-nowrap text-foreground">{formatCurrency(poolFare)}</p>
          <p className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">per keke</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
            Keke Pool
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {occupied}/{group.maxSize} seats
          </span>
        </div>
        <button
          type="button"
          onClick={onOpen}
          disabled={joining}
          className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
        >
          {joining ? 'Joining…' : 'Join pool'}
        </button>
      </div>
    </div>
  )
}
