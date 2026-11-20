import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  UserGroupIcon,
  MapPinIcon,
  Sofa01Icon,
  ArrowLeft01Icon,
  User02Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  CreditCardIcon,
} from 'hugeicons-react'
import { CAMPUS_LOCATIONS } from '../../config/locations'
import { GROUP_SEATS, groupFare, perSeatFare } from '../../config/pricing'
import { useApp } from '../../context/AppContext'
import { formatCurrency } from '../../utils/format'
import { AppHeader } from '../../components/navigation/AppHeader'
import { Button } from '../../components/ui/Button'
import { RouteSelector } from '../../components/shared/RouteSelector'
import { MembershipBlockModal } from '../../components/groups/MembershipBlockModal'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../utils/cn'
import type { CampusLocation } from '../../types'

export function CreateGroup() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { createGroup, activeGroup, leaveGroup } = useApp()
  const { student } = useAuth()

  const pickupId = params.get('pickup') ?? ''
  const destinationId = params.get('destination') ?? ''
  // FindRide's seat selector arrives as a query param and used to be dropped.
  const requestedSeats = Number.parseInt(params.get('seats') ?? '', 10)
  const pickup = CAMPUS_LOCATIONS.find((l) => l.id === pickupId)
  const destination = CAMPUS_LOCATIONS.find((l) => l.id === destinationId)

  // Seats the student is paying for, including their own. Preset from the
  // FindRide selector and adjustable here before the group is created.
  const [seats, setSeats] = useState(() =>
    Number.isInteger(requestedSeats) && requestedSeats >= 1 && requestedSeats <= GROUP_SEATS
      ? requestedSeats
      : 1,
  )

  const [busy, setBusy] = useState<'create' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveBlocked, setLeaveBlocked] = useState(false)

  if (!pickup || !destination) {
    return (
      <>
        <AppHeader title="New group" />
        <div className="flex flex-col gap-5 pb-10 pt-3">
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <MapPinIcon aria-hidden className="size-5 text-muted-foreground" />
              </span>
              <div>
                <h1 className="text-base font-bold text-foreground">Start a new group</h1>
                <p className="text-sm text-muted-foreground">Choose your route and others can join you.</p>
              </div>
            </div>
            <div className="mt-4">
              <RouteSelector
                submitLabel="Continue"
                onSubmit={(p: CampusLocation, d: CampusLocation) =>
                  navigate(`/create-group?pickup=${encodeURIComponent(p.id)}&destination=${encodeURIComponent(d.id)}`)
                }
              />
            </div>
          </div>
        </div>
      </>
    )
  }

  const handleCreate = async () => {
    if (activeGroup) {
      setBlocked(true)
      return
    }
    setBusy('create')
    setError(null)
    try {
      // `seats` covers the student's own slot plus any extras paid for here.
      const group = await createGroup(pickup, destination, seats)
      navigate(`/groups/${group.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your group. Please try again.')
      setBusy(null)
    }
  }

  const handleLeave = async () => {
    if (!activeGroup) return
    setLeaving(true)
    setLeaveBlocked(false)
    try {
      await leaveGroup(activeGroup.id)
      setBlocked(false)
    } catch {
      setLeaveBlocked(true)
    } finally {
      setLeaving(false)
    }
  }

  // Quote shown before the group exists. The server reprices from the same
  // coordinates once the group is created, so the charged total may not drift
  // from this figure.
  const perSeat = perSeatFare(pickup.id, destination.id)
  const youPay = perSeat * seats
  const fullTotal = groupFare(pickup.id, destination.id)
  const yourName = student?.fullName.trim() || 'You'
  // Seats the student is covering beyond their own. `seats` slots are spoken
  // for, so the group has `GROUP_SEATS - seats` empty seats left for others.
  const extraSeats = seats - 1
  const emptySeats = GROUP_SEATS - seats

  return (
    <div className="flex min-h-full flex-col gap-5 pb-10 pt-10 lg:pt-8">
      {/* Header — same pattern as Group details */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft01Icon aria-hidden className="size-4.5" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Keke Pool
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              New group
            </h1>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-xs font-semibold text-foreground">
          <UserGroupIcon aria-hidden className="size-4 shrink-0" />
          <span className="whitespace-nowrap tabular-nums">
            {seats}/{GROUP_SEATS} seats
          </span>
        </span>
      </header>

      {/* Route + fare card — same as Group details */}
      <section aria-label="Group route and fare" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <div aria-hidden className="flex shrink-0 flex-col items-center pt-1.5">
              <span className="size-2.5 rounded-full border-2 border-primary" />
              <span className="my-1.5 w-px flex-1 bg-border" />
              <span className="size-2.5 rounded-[4px] bg-foreground" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">From</p>
              <p className="mt-0.5 truncate text-base font-bold text-foreground sm:text-lg">
                {pickup.name}
              </p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</p>
              <p className="mt-0.5 truncate text-base font-bold text-foreground sm:text-lg">
                {destination.name}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tracking-tight whitespace-nowrap text-foreground sm:text-3xl">
              {formatCurrency(fullTotal)}
            </p>
            <p className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">per keke</p>
          </div>
        </div>

        <div className="my-5 border-t border-border" />

        <div className="flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Seats you cover
            </p>
            <div className="mt-2.5 flex items-center gap-2" aria-label={`${seats} of ${GROUP_SEATS} seats covered`}>
              {Array.from({ length: GROUP_SEATS }, (_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full border',
                    i < seats
                      ? 'border-border bg-muted text-foreground'
                      : 'border-dashed border-border text-muted-foreground',
                  )}
                >
                  <User02Icon className="size-4.5" />
                </span>
              ))}
            </div>
            <p className="mt-2.5 truncate text-sm font-semibold text-foreground">
              {seats} of {GROUP_SEATS} seats covered
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Fare split
            </p>
            <p className="mt-2 text-xl font-bold tracking-tight whitespace-nowrap text-foreground">
              {formatCurrency(perSeat)}{' '}
              <span className="text-sm font-medium text-muted-foreground">each</span>
            </p>
            <p className="mt-1 text-xs whitespace-nowrap text-muted-foreground">
              {formatCurrency(fullTotal)} shared by {GROUP_SEATS} passengers
            </p>
          </div>
        </div>
      </section>

      {/* Seats selector */}
      <section aria-label="Seats you are paying for" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="truncate text-base font-bold text-foreground">Seats you are paying for</h2>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
            <Sofa01Icon aria-hidden className="size-4 shrink-0" />
            <span className="whitespace-nowrap tabular-nums">
              {seats}/{GROUP_SEATS}
            </span>
          </span>
        </div>

        <div className="mt-3 flex gap-2" role="group" aria-label="Number of seats to pay for">
          {Array.from({ length: GROUP_SEATS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSeats(n)}
              aria-pressed={seats === n}
              className={cn(
                'min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors',
                seats === n
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-muted px-3.5 py-2.5 text-sm leading-relaxed break-words text-muted-foreground">
          <CreditCardIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <strong className="whitespace-nowrap text-foreground">
              {formatCurrency(perSeat)} × {seats} seat{seats > 1 ? 's' : ''} = {formatCurrency(youPay)}
            </strong>
            {seats > 1
              ? ' — you cover the seats, so the others can stay empty.'
              : ' — add passengers by sharing the code, or pay for the empty seats later.'}
          </span>
        </p>
      </section>

      {/* Passengers preview — same as Group details */}
      <section aria-label="Passengers" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="truncate text-base font-bold text-foreground">Passengers</h2>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
            <UserGroupIcon aria-hidden className="size-4 shrink-0" />
            <span className="whitespace-nowrap tabular-nums">
              {seats}/{GROUP_SEATS}
            </span>
          </span>
        </div>

        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={seats}
          aria-valuemin={0}
          aria-valuemax={GROUP_SEATS}
          aria-label={`${seats} of ${GROUP_SEATS} seats covered`}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(seats / GROUP_SEATS) * 100}%` }}
          />
        </div>

        <ul className="mt-2 divide-y divide-border">
          <li className="flex min-w-0 items-center gap-2.5 py-2.5">
            <CheckmarkCircle02Icon aria-hidden className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{yourName}</span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-foreground">
              You
            </span>
          </li>
          {Array.from({ length: Math.max(0, extraSeats) }, (_, i) => (
            <li key={`paid-${i}`} className="flex min-w-0 items-center gap-2.5 py-2.5">
              <CreditCardIcon aria-hidden className="size-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Seat paid for</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-foreground">
                Paid
              </span>
            </li>
          ))}
          {Array.from({ length: Math.max(0, emptySeats) }, (_, i) => (
            <li key={`empty-${i}`} className="flex min-w-0 items-center gap-2.5 py-2.5">
              <CircleIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">Empty seat</span>
              <span className="shrink-0 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-muted-foreground">
                Open
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-muted px-3.5 py-2.5 text-sm leading-relaxed break-words text-muted-foreground">
          <UserGroupIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            {emptySeats > 0 ? (
              <>
                Your group needs{' '}
                <strong className="whitespace-nowrap text-foreground">
                  {emptySeats} more passenger{emptySeats > 1 ? 's' : ''}
                </strong>{' '}
                before a driver is matched — or you can pay for the empty seats yourself.
              </>
            ) : (
              <strong className="text-foreground">
                All {GROUP_SEATS} seats are covered — we will match a driver right away.
              </strong>
            )}
          </span>
        </p>
      </section>

      {error && (
        <p role="alert" className="text-sm break-words text-rose-600">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button size="lg" fullWidth loading={busy === 'create'} onClick={handleCreate} className="min-w-0">
          <UserGroupIcon aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Create Group</span>
        </Button>
        <p className="px-2 text-center text-xs break-words text-muted-foreground">
          The ride is only sent to drivers once all {GROUP_SEATS} seats are filled.
        </p>
      </div>

      <MembershipBlockModal
        open={blocked}
        code={activeGroup?.code ?? ''}
        leaving={leaving}
        warning={leaveBlocked ? 'A driver is already assigned to this trip. You cannot leave the group now.' : null}
        onClose={() => {
          setBlocked(false)
          setLeaveBlocked(false)
        }}
        onViewGroup={() => {
          setBlocked(false)
          if (activeGroup) navigate(`/groups/${activeGroup.id}`)
        }}
        onLeaveGroup={handleLeave}
      />
    </div>
  )
}