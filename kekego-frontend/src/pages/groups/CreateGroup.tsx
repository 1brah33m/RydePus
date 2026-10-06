import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Users, MapPin, Armchair } from 'lucide-react'
import { CAMPUS_LOCATIONS } from '../../config/locations'
import { GROUP_SEATS, groupFare, perSeatFare } from '../../config/pricing'
import { useApp } from '../../context/AppContext'
import { formatCurrency } from '../../utils/format'
import { AppHeader } from '../../components/navigation/AppHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { RouteIndicator } from '../../components/shared/RouteIndicator'
import { RouteSelector } from '../../components/shared/RouteSelector'
import { PassengerSlots } from '../../components/groups/PassengerSlots'
import { MembershipBlockModal } from '../../components/groups/MembershipBlockModal'
import { useAuth } from '../../context/AuthContext'
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
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                <MapPin aria-hidden className="size-5 text-brand-600 dark:text-brand-400" />
              </span>
              <div>
                <h1 className="text-base font-bold text-ink-900 dark:text-slate-100">Start a new group</h1>
                <p className="text-sm text-ink-500 dark:text-slate-400">Choose your route and others can join you.</p>
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
          </Card>
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
  const memberList = student ? [{ id: 'you', name: student.fullName, seats: 1, isCurrentUser: true } as const] : []

  return (
    <>
      <AppHeader title="New group" />
      <div className="flex flex-col gap-5 pb-10 pt-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Route</p>
          <RouteIndicator pickup={pickup} destination={destination} className="mt-1.5" />
          <p className="mt-2.5 text-xs text-ink-500 dark:text-slate-400">
            Group of <strong className="text-ink-700 dark:text-slate-300">{GROUP_SEATS} seats</strong> ·{' '}
            {formatCurrency(perSeat)} per seat · {formatCurrency(fullTotal)} when full
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Seats you are paying for</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
              <Armchair aria-hidden className="size-4" />
              {seats}/{GROUP_SEATS}
            </span>
          </div>

          <div className="mt-3 flex gap-2" role="group" aria-label="Number of seats to pay for">
            {Array.from({ length: GROUP_SEATS }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSeats(n)}
                aria-pressed={seats === n}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  seats === n
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-ink-200 bg-white text-ink-600 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <p className="mt-3 rounded-xl bg-ink-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-ink-600 dark:text-slate-400">
            <strong className="text-ink-800 dark:text-slate-200">
              {formatCurrency(perSeat)} × {seats} seat{seats > 1 ? 's' : ''} = {formatCurrency(youPay)}
            </strong>
            {seats > 1
              ? ` — you cover the ${seats} seats, so the others can stay empty.`
              : ' — add passengers by sharing the code, or pay for the empty seats later.'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Passengers</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
              <Users aria-hidden className="size-4" />1/{GROUP_SEATS}
            </span>
          </div>
          <div className="mt-3">
            <PassengerSlots members={memberList} maxSlots={GROUP_SEATS} waitingLabel="Empty seat" />
          </div>
          <p className="mt-3 rounded-xl bg-ink-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-ink-600 dark:text-slate-400">
            Your group needs <strong className="text-ink-800 dark:text-slate-200">{GROUP_SEATS - 1} more passenger{GROUP_SEATS - 1 > 1 ? 's' : ''}</strong> before
            a driver is matched — or you can pay for the empty seats yourself.
          </p>
        </Card>

        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button size="lg" fullWidth loading={busy === 'create'} onClick={handleCreate}>
            <Users aria-hidden className="size-4" />
            Create Group
          </Button>
          <p className="px-2 text-center text-xs text-ink-400 dark:text-slate-500">
            The ride is only sent to drivers once all {GROUP_SEATS} seats are filled.
          </p>
        </div>
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
    </>
  )
}