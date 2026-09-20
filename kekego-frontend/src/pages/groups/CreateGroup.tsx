import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CreditCard, Users, MapPin } from 'lucide-react'
import { CAMPUS_LOCATIONS, FARE_PER_SEAT, MAX_GROUP_SIZE } from '../../mock/data'
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
  const pickup = CAMPUS_LOCATIONS.find((l) => l.id === pickupId)
  const destination = CAMPUS_LOCATIONS.find((l) => l.id === destinationId)

  const rawSeats = Number(params.get('seats'))
  const requestedSeats = Number.isInteger(rawSeats) ? Math.min(MAX_GROUP_SIZE, Math.max(1, rawSeats)) : 1

  const [busy, setBusy] = useState<'create' | 'pay' | null>(null)
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
      const group = await createGroup(pickup, destination, requestedSeats)
      navigate(`/groups/${group.id}`, { replace: true })
    } catch {
      setError('Could not create your group. Please try again.')
      setBusy(null)
    }
  }

  const handlePayFour = () => {
    if (activeGroup) {
      setBlocked(true)
      return
    }
    navigate(`/payment/review?pickup=${encodeURIComponent(pickup.id)}&destination=${encodeURIComponent(destination.id)}`)
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

  const fullSeatPrice = FARE_PER_SEAT * 4
  const remaining = requestedSeats >= MAX_GROUP_SIZE ? 0 : MAX_GROUP_SIZE - requestedSeats
  const memberList = student ? [{ id: 'you', name: student.fullName, seats: requestedSeats, isCurrentUser: true } as const] : []

  return (
    <>
      <AppHeader title="New group" />
      <div className="flex flex-col gap-5 pb-10 pt-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Route</p>
          <RouteIndicator pickup={pickup} destination={destination} className="mt-1.5" />
          {requestedSeats > 1 && (
            <p className="mt-2.5 text-xs text-ink-500 dark:text-slate-400">
              Booking <strong className="text-ink-700 dark:text-slate-300">{requestedSeats} seats</strong> for this group
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Passengers</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
              <Users aria-hidden className="size-4" />{requestedSeats}/{MAX_GROUP_SIZE}
            </span>
          </div>
          <div className="mt-3">
            <PassengerSlots members={memberList} waitingLabel="Waiting for passenger" />
          </div>
          {remaining > 0 ? (
            <p className="mt-3 rounded-xl bg-ink-50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-ink-600 dark:text-slate-400">
              You&apos;ll be waiting for <strong className="text-ink-800 dark:text-slate-200">{remaining} more passenger{remaining > 1 ? 's' : ''}</strong> to
              fill this group.
            </p>
          ) : (
            <p className="mt-3 rounded-xl bg-ink-50 dark:bg-white/5 px-3.5 py-2.5 text-sm font-semibold text-ink-800 dark:text-slate-200">
              Your group is full — a driver is being assigned now.
            </p>
          )}
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
          <Button
            size="lg"
            fullWidth
            variant="secondary"
            onClick={handlePayFour}
          >
            <CreditCard aria-hidden className="size-4" />
            Pay for 4 Seats
            <span className="ml-auto rounded-lg bg-white/15 px-2 py-0.5 text-xs font-semibold">
              {formatCurrency(fullSeatPrice)}
            </span>
          </Button>
          <p className="px-2 text-center text-xs text-ink-400 dark:text-slate-500">
            Pay for all 4 seats and your group goes straight to a driver — no waiting.
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