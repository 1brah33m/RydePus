import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Users, X, Search, LogOut, Lock, CreditCard } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { isGroupCancellationLocked } from '../../utils/rideStatus'
import { perSeatFare } from '../../config/pricing'
import { formatCurrency } from '../../utils/format'
import { AppHeader } from '../../components/navigation/AppHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { RouteIndicator } from '../../components/shared/RouteIndicator'
import { PassengerSlots } from '../../components/groups/PassengerSlots'

export function GroupStatus() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const { state, activeGroup, cancelGroup, leaveGroup, buyOutGroup } = useApp()

  const group =
    state.groups.find((g) => g.id === groupId) ?? state.groups.find((g) => g.code === groupId)

  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveBlocked, setLeaveBlocked] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [buyOutOpen, setBuyOutOpen] = useState(false)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)

  // Once a driver is matched, the group hands over to the trip screen.
  useEffect(() => {
    if (!group) return
    if (
      group.status === 'DRIVER_ASSIGNED' ||
      group.status === 'DRIVER_ACCEPTED' ||
      group.status === 'IN_TRIP' ||
      group.status === 'COMPLETED'
    ) {
      if (group.tripId) {
        navigate(`/trips/${group.tripId}`, { replace: true })
      }
    }
  }, [group, navigate])

  if (!group) {
    return (
      <>
        <AppHeader title="Group" />
        <div className="pt-3">
          <EmptyState
            icon={Users}
            title="Group not found"
            description="This group no longer exists or you are not a member."
            action={<Button to="/home">Back to Home</Button>}
          />
        </div>
      </>
    )
  }

  const isActive = activeGroup?.id === group.id
  const occupied = group.seatsFilled
  const waiting = group.maxSize - occupied
  const searching = group.status === 'FULL' || group.status === 'SEARCHING_DRIVER'
  const matched = isGroupCancellationLocked(group.status)
  const perSeat = perSeatFare(group.pickup.id, group.destination.id)
  const buyOutTotal = perSeat * waiting

  const handleCancel = async () => {
    setBusy(true)
    setCancelError(null)
    try {
      await cancelGroup(group.id)
      navigate('/home', { replace: true })
    } catch (err) {
      setBusy(false)
      setCancelError(err instanceof Error ? err.message : 'Could not cancel the request. Please try again.')
    }
  }

  /** Cover every empty seat so the group can be dispatched immediately. */
  const handleBuyOut = async () => {
    setBuying(true)
    setBuyError(null)
    try {
      await buyOutGroup(group.id)
      setBuyOutOpen(false)
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'We could not take that payment. Please try again.')
    } finally {
      setBuying(false)
    }
  }

  /** Leave the group, freeing the seat(s) for others and clearing the active selection. */
  const handleLeave = async () => {
    setLeaving(true)
    setLeaveBlocked(false)
    try {
      await leaveGroup(group.id)
      navigate('/groups', { replace: true })
    } catch {
      setLeaving(false)
      setLeaveBlocked(true)
    }
  }

  return (
    <>
      <AppHeader title={`Group ${group.code}`} />
      <div className="flex flex-col gap-5 pb-10 pt-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Route</p>
          <RouteIndicator pickup={group.pickup} destination={group.destination} className="mt-1.5" />
          <div className="mt-3 flex items-center gap-2 text-sm text-ink-600 dark:text-slate-400">
            <Users aria-hidden className="size-4 text-ink-400 dark:text-slate-500" />
            <span className="font-semibold text-ink-800 dark:text-slate-200">
              {occupied}/{group.maxSize} passengers
            </span>
          </div>
        </Card>

        {!isActive ? (
          <EmptyState
            icon={Users}
            title="You are not in this group"
            description="This group was opened from a shared link, but you are not a member of it."
            action={<Button to="/home">Back to Home</Button>}
          />
        ) : searching ? (
          <SearchingForDriver
            groupOccupied={occupied}
            groupMax={group.maxSize}
            leaving={leaving}
            onLeave={handleLeave}
          />
        ) : matched ? (
          <CancellationLockedNotice tripId={group.tripId} />
        ) : (
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Passengers</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
                <Users aria-hidden className="size-4" />
                {occupied}/{group.maxSize}
              </span>
            </div>

            <div className="mt-3">
              <PassengerSlots
                members={group.members}
                boughtSeats={group.boughtSeats}
                waitingLabel="Empty seat"
              />
            </div>

            <p className="mt-4 rounded-xl bg-ink-50 dark:bg-white/5 px-3.5 py-2.5 text-sm leading-relaxed text-ink-600 dark:text-slate-400">
              {waiting > 0 ? (
                <>
                  Your group needs <strong className="text-ink-800 dark:text-slate-200">{waiting} more passenger{waiting === 1 ? '' : 's'}</strong> before a
                  driver is matched.
                </>
              ) : (
                <>
                  All <strong className="text-ink-800 dark:text-slate-200">{group.maxSize} seats</strong> are taken
                  {group.boughtSeats > 0 && ' (including the seats you paid for)'}.
                </>
              )}
            </p>

            {waiting > 0 && (
              <Button
                size="lg"
                fullWidth
                className="mt-3"
                onClick={() => {
                  setBuyError(null)
                  setBuyOutOpen(true)
                }}
              >
                <CreditCard aria-hidden className="size-4" />
                Fill {waiting} seat{waiting === 1 ? '' : 's'} — {formatCurrency(buyOutTotal)}
              </Button>
            )}

            <div className="mt-5 flex flex-col gap-2.5">
              <Button size="lg" fullWidth variant="outline" disabled={busy}>
                <Users aria-hidden className="size-4" />
                {occupied}/{group.maxSize} — share this group's code{' '}
                <span className="font-bold">{group.code}</span>
              </Button>
              <div className="grid grid-cols-2 gap-2.5">
                <Button size="lg" fullWidth variant="outline" loading={leaving} onClick={handleLeave}>
                  <LogOut aria-hidden className="size-4" />
                  Leave Group
                </Button>
                <Button size="lg" fullWidth variant="danger" loading={busy} onClick={handleCancel}>
                  <X aria-hidden className="size-4" />
                  Cancel Request
                </Button>
              </div>
              {cancelError && <Alert tone="error" className="mt-3">{cancelError}</Alert>}
            </div>
          </Card>
        )}
      </div>

      <Modal open={buyOutOpen} onClose={() => setBuyOutOpen(false)} title="Fill the empty seats">
        <p className="text-sm leading-relaxed text-ink-600 dark:text-slate-300">
          You&apos;re paying for the {waiting} empty seat{waiting === 1 ? '' : 's'} so everyone in this group can
          leave right away.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink-500 dark:text-slate-400">Empty seats</dt>
            <dd className="font-semibold text-ink-800 dark:text-slate-200">{waiting}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-500 dark:text-slate-400">Fare per seat</dt>
            <dd className="font-semibold text-ink-800 dark:text-slate-200">{formatCurrency(perSeat)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-ink-100 pt-2 dark:border-white/10">
            <dt className="font-semibold text-ink-800 dark:text-slate-200">Total</dt>
            <dd className="text-lg font-bold text-brand-700 dark:text-brand-300">{formatCurrency(buyOutTotal)}</dd>
          </div>
        </dl>
        {buyError && <Alert tone="error" className="mt-4">{buyError}</Alert>}
        <div className="mt-5 flex flex-col gap-2.5">
          <Button size="lg" fullWidth loading={buying} onClick={handleBuyOut}>
            <CreditCard aria-hidden className="size-4" />
            Pay {formatCurrency(buyOutTotal)} and go now
          </Button>
          <Button size="lg" fullWidth variant="outline" onClick={() => setBuyOutOpen(false)}>
            Not now
          </Button>
        </div>
      </Modal>

      <Modal open={leaveBlocked} onClose={() => setLeaveBlocked(false)} title="Can't leave this trip">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Lock aria-hidden className="size-5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-600 dark:text-slate-300">
            A driver is already assigned to this trip. You cannot leave the group now.
          </p>
        </div>
        <div className="mt-5">
          <Button size="lg" fullWidth onClick={() => setLeaveBlocked(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </>
  )
}

function SearchingForDriver({
  groupOccupied,
  groupMax,
  leaving,
  onLeave,
}: {
  groupOccupied: number
  groupMax: number
  leaving: boolean
  onLeave: () => void
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-brand-600 px-5 pb-6 pt-5 text-white">
        <h2 className="text-xl font-bold tracking-tight">Your group is searching!</h2>
        <div className="mt-1 flex items-center gap-2 text-brand-100">
          <Users aria-hidden className="size-4" />
          {groupOccupied}/{groupMax} passengers
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5 ring-1 ring-white/15">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Search aria-hidden className="size-4.5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Finding an available keke driver…</p>
            <p className="text-xs text-brand-100">This usually takes less than a minute.</p>
          </div>
          <span className="flex items-center gap-1" aria-label="Searching">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-white"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Status</p>
        <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-500" />
          SEARCHING FOR DRIVER
        </p>

        <button
          type="button"
          onClick={onLeave}
          disabled={leaving}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 transition-colors hover:text-rose-600 disabled:opacity-60 dark:text-slate-400 dark:hover:text-rose-400"
        >
          <LogOut aria-hidden className="size-4" />
          {leaving ? 'Leaving…' : 'Leave group'}
        </button>
      </div>
    </Card>
  )
}

function CancellationLockedNotice({ tripId }: { tripId?: string }) {
  return (
    <Card className="border-amber-200 bg-amber-50/70 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <Lock aria-hidden className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Cancellation locked</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800/80 dark:text-amber-200/80">
            A driver has accepted your ride. Cancellation is no longer available; please contact support or your
            driver if necessary.
          </p>
        </div>
      </div>
      {tripId && (
        <Button className="mt-4" variant="outline" fullWidth to={`/trips/${tripId}`}>
          View trip
        </Button>
      )}
    </Card>
  )
}