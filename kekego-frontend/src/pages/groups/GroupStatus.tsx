import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  UserGroupIcon,
  Cancel01Icon,
  Search01Icon,
  Logout01Icon,
  LockIcon,
  CreditCardIcon,
  Sofa01Icon,
  ArrowLeft01Icon,
  User02Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  AlertCircleIcon,
} from 'hugeicons-react'
import { useApp } from '../../context/AppContext'
import { isGroupCancellationLocked, isLeaveLockedError } from '../../utils/rideStatus'
import { formatCurrency } from '../../utils/format'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { MembershipBlockModal } from '../../components/groups/MembershipBlockModal'
import { JoinSeatsModal } from '../../components/groups/JoinSeatsModal'
import { cn } from '../../utils/cn'

export function GroupStatus() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const { state, activeGroup, cancelGroup, leaveGroup, buyOutGroup, joinGroup } = useApp()

  const group =
    state.groups.find((g) => g.id === groupId) ?? state.groups.find((g) => g.code === groupId)

  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blockLeaving, setBlockLeaving] = useState(false)
  const [blockWarning, setBlockWarning] = useState<string | null>(null)
  const [seatPickerOpen, setSeatPickerOpen] = useState(false)
  const [pendingJoinSeats, setPendingJoinSeats] = useState(1)
  const [leaveBlocked, setLeaveBlocked] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [dismissedNoticeFor, setDismissedNoticeFor] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [buyOutOpen, setBuyOutOpen] = useState(false)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [buyOutSeats, setBuyOutSeats] = useState(0)

  // Brief toast for the "pool is full" notice: shows on arrival, hides itself.
  const noticeId = group?.id
  const showFullNotice = noticeId != null && dismissedNoticeFor !== noticeId
  useEffect(() => {
    if (!noticeId) return
    const timer = setTimeout(() => setDismissedNoticeFor(noticeId), 6000)
    return () => clearTimeout(timer)
  }, [noticeId])

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
      <div className="flex flex-col gap-6 pb-10 pt-10 lg:pt-8">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
            <UserGroupIcon aria-hidden className="size-7 text-muted-foreground" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-foreground">Group not found</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            This group no longer exists or you are not a member.
          </p>
          <Button to="/home" className="mt-5">
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  const isMember = group?.members.some((m) => m.isCurrentUser) ?? false
  const isActive = activeGroup?.id === group?.id || isMember
  const isCreator =
    group?.isCreator ?? group?.members.some((m) => m.isCurrentUser && m.isCreator) ?? false
  const occupied = group.seatsFilled
  const waiting = group.remainingSeats
  const full = occupied >= group.maxSize || waiting <= 0
  const searching = group.status === 'FULL' || group.status === 'SEARCHING_DRIVER'
  const matched = isGroupCancellationLocked(group.status)
  // Server-priced, so the number shown here is the number that gets charged.
  const perSeat = group.farePerSeat
  // A buyout is one consolidated charge for the whole share: the student's own
  // seat (billed once, while it is still unpaid) plus the empty seats filled.
  const ownSeatDue = group.ownSeatPaid ? 0 : 1
  const buyOutTotal = perSeat * (waiting + ownSeatDue)

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

  /**
   * Cover the selected empty seats. Buying all of them makes the group
   * dispatchable; buying fewer leaves those seats open for other passengers.
   */
  const handleBuyOut = async () => {
    setBuying(true)
    setBuyError(null)
    try {
      await buyOutGroup(group.id, buyOutSeats || undefined)
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
    setLeaveError(null)
    try {
      await leaveGroup(group.id)
      navigate('/groups', { replace: true })
    } catch (err) {
      setLeaving(false)
      // Only a committed driver locks leaving; any other failure (not a
      // member, network, ...) must show its real message, not the lock modal.
      if (isLeaveLockedError(err)) {
        setLeaveBlocked(true)
      } else {
        setLeaveError(err instanceof Error ? err.message : 'Could not leave this group. Please try again.')
      }
    }
  }

  /** Join button: blocked members go to the switch-group flow, otherwise the
   * joiner explicitly picks how many seats to pay for — never auto-assigned. */
  const handleJoinClick = () => {
    // Already in a different group: offer to view it or leave it first,
    // instead of firing a request that the server must reject.
    if (activeGroup && activeGroup.id !== group.id) {
      setPendingJoinSeats(1)
      setBlockedOpen(true)
      return
    }
    setJoinError(null)
    if (waiting > 1) {
      setPendingJoinSeats(1)
      setSeatPickerOpen(true)
      return
    }
    void handleJoin(1)
  }

  /** Join a shared group with the explicitly chosen seat count, then open it.
   * Surfaces errors instead of swallowing them. */
  const handleJoin = async (seats = 1) => {
    setJoining(true)
    setJoinError(null)
    try {
      const joined = await joinGroup(group.id, seats)
      navigate(`/groups/${joined.id}`, { replace: true })
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join this group. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  /** Leave the current group, then join this shared one. */
  const handleLeaveAndJoin = async () => {
    if (!activeGroup) {
      setBlockedOpen(false)
      return
    }
    setBlockLeaving(true)
    setBlockWarning(null)
    setJoinError(null)
    try {
      await leaveGroup(activeGroup.id)
      setBlockedOpen(false)
      setBlockLeaving(false)
      // After leaving, the joiner still picks their own seat count — never
      // inherit anything automatically.
      if (waiting > 1) {
        setSeatPickerOpen(true)
        return
      }
      setJoining(true)
      try {
        const joined = await joinGroup(group.id, pendingJoinSeats)
        navigate(`/groups/${joined.id}`, { replace: true })
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : 'Could not join this group. Please try again.')
      } finally {
        setJoining(false)
      }
    } catch (err) {
      setBlockLeaving(false)
      if (isLeaveLockedError(err)) {
        setBlockWarning('A driver is already assigned to this trip. You cannot leave the group now.')
      } else {
        setBlockedOpen(false)
        setJoinError(err instanceof Error ? err.message : 'Could not leave your current group. Please try again.')
      }
    }
  }

  const findAnotherRide = () => {
    navigate('/groups')
  }

  return (
    <div className="flex min-h-full flex-col gap-5 pb-10 pt-10 lg:pt-8">
      {/* Header */}
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
              Group details
            </h1>
          </div>
        </div>
        {!isActive ? (
          <span className="shrink-0 rounded-full border border-border bg-muted px-3.5 py-1.5 text-xs font-semibold text-foreground">
            Shared with you
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-border bg-muted px-3.5 py-1.5 text-xs font-semibold text-foreground">
            {occupied}/{group.maxSize} seats
          </span>
        )}
      </header>

      {/* Route + fare card */}
      <section aria-label="Group route and fare" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <div aria-hidden className="flex flex-col items-center pt-1.5">
              <span className="size-2.5 rounded-full border-2 border-primary" />
              <span className="my-1.5 w-px flex-1 bg-border" />
              <span className="size-2.5 rounded-[4px] bg-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">From</p>
              <p className="mt-0.5 truncate text-base font-bold text-foreground sm:text-lg">
                {group.pickup.name}
              </p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</p>
              <p className="mt-0.5 truncate text-base font-bold text-foreground sm:text-lg">
                {group.destination.name}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {formatCurrency(group.fareTotal)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">per keke</p>
          </div>
        </div>

        <div className="my-5 border-t border-border" />

        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Passengers
            </p>
            <div className="mt-2.5 flex items-center gap-2" aria-label={`${occupied} of ${group.maxSize} seats taken`}>
              {Array.from({ length: group.maxSize }, (_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full border',
                    i < occupied
                      ? 'border-border bg-muted text-foreground'
                      : 'border-dashed border-border text-muted-foreground',
                  )}
                >
                  <User02Icon className="size-4.5" />
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-sm font-semibold text-foreground">
              {occupied} of {group.maxSize} seats taken
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Fare split
            </p>
            <p className="mt-2 text-xl font-bold tracking-tight text-foreground">
              {formatCurrency(perSeat)}{' '}
              <span className="text-sm font-medium text-muted-foreground">each</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(group.fareTotal)} shared by {group.maxSize} passengers
            </p>
          </div>
        </div>
      </section>

      {/* State body */}
      {!isActive ? (
        full ? (
          <>
            {showFullNotice && (
              <div
                role="status"
                className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-ryde-rise lg:bottom-8"
              >
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-lg dark:border-amber-500/30 dark:bg-amber-500/10">
                  <AlertCircleIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">This pool is full</p>
                    <p className="mt-0.5 text-sm text-amber-800/80 dark:text-amber-200/80">
                      All {group.maxSize} seats are taken.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => noticeId && setDismissedNoticeFor(noticeId)}
                    aria-label="Dismiss"
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-amber-800/70 transition-colors hover:bg-amber-900/10 dark:text-amber-200/70 dark:hover:bg-amber-200/10"
                  >
                    <Cancel01Icon aria-hidden className="size-4" />
                  </button>
                </div>
              </div>
            )}
            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Button size="lg" fullWidth onClick={findAnotherRide}>
                Find another ride on this route
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/home')}>
                Back to Home
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted p-4">
              <UserGroupIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-bold text-foreground">You are not in this group</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  This group was shared with you and still has {waiting} open seat{waiting === 1 ? '' : 's'}.
                  Join it to ride with this pool.
                </p>
              </div>
            </div>
            {joinError && (
              <Alert tone="error">
                <div className="flex items-start justify-between gap-3">
                  <span>{joinError}</span>
                  <button
                    type="button"
                    onClick={() => setJoinError(null)}
                    className="shrink-0 font-semibold underline"
                  >
                    Dismiss
                  </button>
                </div>
              </Alert>
            )}
            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Button size="lg" fullWidth loading={joining} onClick={handleJoinClick}>
                Join pool — {formatCurrency(perSeat)} a seat
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/home')}>
                Back to Home
              </Button>
            </div>
            <JoinSeatsModal
              open={seatPickerOpen}
              max={waiting}
              perSeat={perSeat}
              initial={1}
              joining={joining}
              onClose={() => setSeatPickerOpen(false)}
              onConfirm={(seats) => {
                setPendingJoinSeats(seats)
                setSeatPickerOpen(false)
                void handleJoin(seats)
              }}
            />
            <MembershipBlockModal
              open={blockedOpen}
              code={activeGroup?.code ?? ''}
              leaving={blockLeaving}
              warning={blockWarning}
              onClose={() => {
                setBlockedOpen(false)
                setBlockWarning(null)
              }}
              onViewGroup={() => {
                setBlockedOpen(false)
                if (activeGroup) navigate(`/groups/${activeGroup.id}`)
              }}
              onLeaveGroup={handleLeaveAndJoin}
            />
          </>
        )
      ) : searching ? (
        <SearchingForDriver
          groupOccupied={occupied}
          groupMax={group.maxSize}
          leaving={leaving}
          leaveError={leaveError}
          onDismissLeaveError={() => setLeaveError(null)}
          onLeave={handleLeave}
        />
      ) : matched ? (
        <CancellationLockedNotice tripId={group.tripId} />
      ) : (
        <section aria-label="Passengers and actions" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h2 className="truncate text-base font-bold text-foreground">Passengers</h2>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
              <UserGroupIcon aria-hidden className="size-4 shrink-0" />
              <span className="tabular-nums whitespace-nowrap">
                {occupied}/{group.maxSize}
              </span>
            </span>
          </div>

          {/* Seat fill progress */}
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={occupied}
            aria-valuemin={0}
            aria-valuemax={group.maxSize}
            aria-label={`${occupied} of ${group.maxSize} seats filled`}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${group.maxSize > 0 ? (occupied / group.maxSize) * 100 : 0}%` }}
            />
          </div>

          <ul className="mt-2 divide-y divide-border">
            {group.members.map((member) => (
              <li key={member.id} className="flex min-w-0 items-center gap-2.5 py-2.5">
                <CheckmarkCircle02Icon aria-hidden className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {member.name}
                </span>
                {member.isCurrentUser && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-foreground">
                    You
                  </span>
                )}
              </li>
            ))}
            {Array.from({ length: Math.max(0, group.maxSize - occupied) }, (_, i) => (
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
              {waiting > 0 ? (
                <>
                  Your group needs{' '}
                  <strong className="whitespace-nowrap text-foreground">
                    {waiting} more passenger{waiting === 1 ? '' : 's'}
                  </strong>{' '}
                  before a driver is matched.
                </>
              ) : (
                <>
                  All <strong className="text-foreground">{group.maxSize} seats</strong> are taken
                  {group.boughtSeats > 0 && ' (including the seats you paid for)'}.
                </>
              )}
            </span>
          </p>

          {waiting > 0 && (
            <Button
              size="lg"
              fullWidth
              className="mt-3 min-w-0"
              onClick={() => {
                setBuyError(null)
                // Default to filling everything, the usual reason to open this.
                setBuyOutSeats(0)
                setBuyOutOpen(true)
              }}
            >
              <CreditCardIcon aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 truncate">Fill empty seats</span>
              <span className="shrink-0 font-bold whitespace-nowrap tabular-nums">
                · up to {formatCurrency(buyOutTotal)}
              </span>
            </Button>
          )}

          <div className="mt-3 flex min-w-0 flex-col gap-2.5">
            {isCreator ? (
              <div className="grid min-w-0 grid-cols-2 gap-2.5">
                <Button
                  size="md"
                  fullWidth
                  variant="outline"
                  loading={leaving}
                  onClick={handleLeave}
                  className="min-w-0 px-3"
                >
                  <Logout01Icon aria-hidden className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">Leave Group</span>
                </Button>
                <Button
                  size="md"
                  fullWidth
                  variant="danger"
                  loading={busy}
                  onClick={handleCancel}
                  className="min-w-0 px-3"
                >
                  <Cancel01Icon aria-hidden className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">Cancel Request</span>
                </Button>
              </div>
            ) : (
              <>
                <Button
                  size="md"
                  fullWidth
                  variant="outline"
                  loading={leaving}
                  onClick={handleLeave}
                  className="min-w-0 px-3"
                >
                  <Logout01Icon aria-hidden className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">Leave Group</span>
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Only the student who created this pool can cancel it for everyone. Leaving
                  frees your seat so you can join or create another group.
                </p>
              </>
            )}
            {cancelError && (
              <Alert tone="error" className="mt-1 break-words">
                {cancelError}
              </Alert>
            )}
            {leaveError && (
              <Alert tone="error" className="mt-1 break-words">
                <div className="flex items-start justify-between gap-3">
                  <span>{leaveError}</span>
                  <button
                    type="button"
                    onClick={() => setLeaveError(null)}
                    className="shrink-0 font-semibold underline"
                  >
                    Dismiss
                  </button>
                </div>
              </Alert>
            )}
          </div>
        </section>
      )}

      {/* Buyout modal */}
      {buyOutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fill the empty seats"
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => setBuyOutOpen(false)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pt-6 shadow-xl sm:my-auto sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Fill the empty seats</h2>
              <button
                type="button"
                onClick={() => setBuyOutOpen(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Cancel01Icon aria-hidden className="size-5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Commit to the whole ride in one go. Register all {waiting} empty seat
              {waiting === 1 ? '' : 's'} to leave right away, or take just the number you need and leave
              the rest open for other passengers. This records your seat count and total — it does not
              pull money from a card now.{' '}
              {ownSeatDue === 1 && 'The total includes your own seat, charged only once.'}
            </p>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Seats to pay for
              </p>
              <div className="mt-2 flex gap-2" role="group" aria-label="Number of seats to pay for">
                {Array.from({ length: waiting }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBuyOutSeats(n)}
                    aria-pressed={(buyOutSeats || waiting) === n}
                    className={cn(
                      'flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors',
                      (buyOutSeats || waiting) === n
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Empty seats</dt>
                <dd className="font-semibold text-foreground">{waiting}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Fare per seat</dt>
                <dd className="font-semibold text-foreground">{formatCurrency(perSeat)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Empty seats to fill</dt>
                <dd className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Sofa01Icon aria-hidden className="size-4" />
                  {buyOutSeats || waiting}
                </dd>
              </div>
              {ownSeatDue === 1 && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Your own seat (one-off)</dt>
                  <dd className="font-semibold text-foreground">{formatCurrency(perSeat)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="font-semibold text-foreground">Total for the ride</dt>
                <dd className="text-lg font-bold text-foreground">
                  {formatCurrency(perSeat * ((buyOutSeats || waiting) + ownSeatDue))}
                </dd>
              </div>
            </dl>
            {buyError && (
              <Alert tone="error" className="mt-4">
                {buyError}
              </Alert>
            )}
            <div className="mt-5 flex flex-col gap-2.5">
              <Button size="lg" fullWidth loading={buying} onClick={handleBuyOut}>
                <CreditCardIcon aria-hidden className="size-4" />
                Add {formatCurrency(perSeat * ((buyOutSeats || waiting) + ownSeatDue))} to trip total
              </Button>
              <Button size="lg" fullWidth variant="outline" onClick={() => setBuyOutOpen(false)}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Leave-blocked modal */}
      {leaveBlocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Can't leave this trip"
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => setLeaveBlocked(false)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pt-6 shadow-xl sm:my-auto sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Can't leave this trip</h2>
              <button
                type="button"
                onClick={() => setLeaveBlocked(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Cancel01Icon aria-hidden className="size-5" />
              </button>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <LockIcon aria-hidden className="size-5" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                A driver is already assigned to this trip. You cannot leave the group now.
              </p>
            </div>
            <div className="mt-5">
              <Button size="lg" fullWidth onClick={() => setLeaveBlocked(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SearchingForDriver({
  groupOccupied,
  groupMax,
  leaving,
  leaveError,
  onLeave,
  onDismissLeaveError,
}: {
  groupOccupied: number
  groupMax: number
  leaving: boolean
  leaveError?: string | null
  onLeave: () => void
  onDismissLeaveError?: () => void
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="bg-primary px-5 pb-6 pt-5 text-primary-foreground">
        <h2 className="text-xl font-bold tracking-tight">Your group is searching!</h2>
        <div className="mt-1 flex items-center gap-2 opacity-80">
          <UserGroupIcon aria-hidden className="size-4" />
          {groupOccupied}/{groupMax} passengers
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-primary-foreground/10 px-4 py-3.5 ring-1 ring-primary-foreground/15">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
            <Search01Icon aria-hidden className="size-4.5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Finding an available keke driver…</p>
            <p className="text-xs opacity-70">This usually takes less than a minute.</p>
          </div>
          <span className="flex items-center gap-1" aria-label="Searching">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-primary-foreground"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
        <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          SEARCHING FOR DRIVER
        </p>

        <button
          type="button"
          onClick={onLeave}
          disabled={leaving}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
        >
          <Logout01Icon aria-hidden className="size-4" />
          {leaving ? 'Leaving…' : 'Leave group'}
        </button>
        {leaveError && (
          <div role="alert" className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
            <span>{leaveError}</span>
            {onDismissLeaveError && (
              <button type="button" onClick={onDismissLeaveError} className="shrink-0 font-semibold underline">
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CancellationLockedNotice({ tripId }: { tripId?: string }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <LockIcon aria-hidden className="size-5" />
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
    </div>
  )
}
