import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Lock, MapPin, Star, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { AppHeader } from '../../components/navigation/AppHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Alert } from '../../components/ui/Alert'
import { EmptyState } from '../../components/ui/EmptyState'
import { TripStatusBadge } from '../../components/ui/StatusBadge'
import { RouteIndicator } from '../../components/shared/RouteIndicator'
import { DriverCard } from '../../components/driver/DriverCard'
import { RatingStars } from '../../components/driver/RatingStars'
import { Input } from '../../components/ui/Input'
import { isTripCancellationLocked } from '../../utils/rideStatus'
import type { Trip } from '../../types'

export function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const { state, getDriverById, cancelTrip, submitRating, settleActivity } = useApp()

  const trip = useMemo(
    () => state.trips.find((t) => t.id === tripId) ?? state.trips.find((t) => t.code === tripId),
    [state.trips, tripId],
  )

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [callNotice, setCallNotice] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  if (!trip) {
    return (
      <>
        <AppHeader title="Trip" />
        <div className="pt-3">
          <EmptyState
            icon={CheckCircle2}
            title="Trip not found"
            description="We could not find this trip in your history."
            action={<Button to="/trips">View Trips</Button>}
          />
        </div>
      </>
    )
  }

  const driver = trip.driverId ? getDriverById(trip.driverId) : trip.driver ?? null
  const inProgress = trip.status === 'IN_PROGRESS'
  const cancellationLocked = isTripCancellationLocked(trip.status)

  const handleCall = () => {
    setCallNotice(true)
  }

  const handleCancel = async () => {
    setCancelling(true)
    setFormError(null)
    try {
      await cancelTrip(trip.id)
      navigate('/home', { replace: true })
    } catch {
      setFormError('Could not cancel the trip. Please try again.')
      setCancelling(false)
    }
  }

  const handleSubmitRating = async () => {
    if (rating === 0) {
      setFormError('Tap a star to rate your ride first.')
      return
    }
    setSubmittingRating(true)
    setFormError(null)
    try {
      await submitRating(trip.id, rating, comment.trim() || undefined)
    } catch {
      setFormError('Could not submit your rating. Please try again.')
      setSubmittingRating(false)
    }
  }

  const finish = () => {
    settleActivity()
    navigate('/trips', { replace: true })
  }

  /* ------------------------------ CANCELLED ------------------------------ */
  if (trip.status === 'CANCELLED') {
    return (
      <>
        <AppHeader title={`Trip ${trip.code}`} />
        <div className="pt-3">
          <Card className="p-6 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-500/15">
              <X aria-hidden className="size-7 text-rose-600 dark:text-rose-300" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-ink-900 dark:text-slate-100">Trip cancelled</h2>
            <RouteIndicator pickup={trip.pickup} destination={trip.destination} className="mt-2 justify-center" size="sm" />
            <p className="mt-2 text-sm text-ink-500 dark:text-slate-400">This trip was cancelled before it started.</p>
            <Button className="mt-5" to="/trips">Back to Trips</Button>
          </Card>
        </div>
      </>
    )
  }

  /* ------------------------------ COMPLETED ------------------------------ */
  if (trip.status === 'COMPLETED') {
    const rated = Boolean(trip.rating)
    return (
      <>
        <AppHeader title="Trip completed" />
        <div className="flex flex-col gap-5 pb-10 pt-3">
          <Card className="p-5 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/15">
              <CheckCircle2 aria-hidden className="size-8 text-emerald-600 dark:text-emerald-300" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-ink-900 dark:text-slate-100">Trip Completed</h2>
            <RouteIndicator pickup={trip.pickup} destination={trip.destination} className="mt-2 justify-center" size="sm" />
            <p className="mt-2 text-sm text-ink-500 dark:text-slate-400">Trip {trip.code} completed successfully.</p>
          </Card>

          {!rated ? (
            <Card className="p-5">
              <h3 className="text-center text-base font-bold text-ink-900 dark:text-slate-100">How was your ride?</h3>
              <div className="mt-4 flex justify-center">
                <RatingStars value={rating} onChange={setRating} size="lg" label="Rate your ride" />
              </div>
              <Input
                className="mt-3"
                label="Add a comment (optional)"
                placeholder="e.g. Smooth ride, courteous driver"
                value={comment}
                maxLength={160}
                onChange={(e) => setComment(e.target.value)}
              />
              {formError && <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-300">{formError}</p>}
              <div className="mt-4 flex flex-col gap-2.5">
                <Button size="lg" fullWidth loading={submittingRating} onClick={handleSubmitRating}>
                  <Star aria-hidden className="size-4 fill-current" />
                  Submit Rating
                </Button>
                <Button variant="ghost" fullWidth onClick={finish}>
                  Skip — go to Trips
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink-700 dark:text-slate-300">Your rating</p>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-keke-600">
                  <Star aria-hidden className="size-4 fill-keke-500" /> {trip.rating}
                </span>
              </div>
              {trip.comment && <p className="mt-2 text-sm text-ink-600 dark:text-slate-400">“{trip.comment}”</p>}
              {driver && (
                <div className="mt-4 border-t border-ink-100 pt-3 text-sm">
                  <p className="text-xs text-ink-400 dark:text-slate-500">Driver</p>
                  <p className="font-medium text-ink-800 dark:text-slate-200">
                    {driver.name} · {driver.kekeIdentifier}
                  </p>
                </div>
              )}
              <Button className="mt-5" fullWidth onClick={finish}>
                Done
              </Button>
            </Card>
          )}
        </div>
      </>
    )
  }

  /* ------------------------------ ACTIVE TRIPS ------------------------------ */
  return (
    <>
      <AppHeader title={inProgress ? 'Trip in progress' : 'Driver found'} />
      <div className="flex flex-col gap-5 pb-10 pt-3">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Trip {trip.code}</p>
            <div className="flex items-center gap-2">
              {cancellationLocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <Lock aria-hidden className="size-3" />
                  Locked
                </span>
              )}
              <TripStatusBadge status={trip.status} />
            </div>
          </div>
          <RouteIndicator pickup={trip.pickup} destination={trip.destination} className="mt-2" />
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
            Passengers <strong>4/4</strong>
          </div>
          <p className="mt-3 text-sm text-ink-600 dark:text-slate-400">
            {inProgress
              ? 'Your keke is on the way to the pickup point.'
              : 'Driver is on the way to the pickup point.'}
          </p>
        </Card>

        {driver && <DriverCard driver={driver} onCall={handleCall} />}

        {inProgress && (
          <RouteProgress pickup={trip.pickup.name} destination={trip.destination.name} statusLabel="ON THE WAY" />
        )}

        {callNotice && <Alert tone="info">Calling would open your phone dialer. (Placeholder — demo only.)</Alert>}

        {cancellationLocked ? (
          <CancellationLockedNotice status={trip.status} />
        ) : confirmCancel ? (
          <Card className="p-5">
            <p className="text-sm text-ink-700 dark:text-slate-300">
              Are you sure you want to cancel this trip? Your group will be disbanded.
            </p>
            {formError && <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-300">{formError}</p>}
            <div className="mt-4 flex gap-3">
              <Button variant="outline" fullWidth onClick={() => setConfirmCancel(false)}>
                Keep trip
              </Button>
              <Button variant="danger" fullWidth loading={cancelling} onClick={handleCancel}>
                Yes, cancel
              </Button>
            </div>
          </Card>
        ) : (
          <Button
            variant="danger"
            size="lg"
            fullWidth
            onClick={() => {
              setFormError(null)
              setConfirmCancel(true)
            }}
          >
            <X aria-hidden className="size-4" />
            Cancel Trip
          </Button>
        )}
      </div>
    </>
  )
}

function CancellationLockedNotice({ status }: { status: Trip['status'] }) {
  const message =
    status === 'DRIVER_ASSIGNED'
      ? 'A driver has been matched to your ride. Cancellation is no longer available; please contact support or your driver if necessary.'
      : 'A driver has accepted your ride. Cancellation is no longer available; please contact support or your driver if necessary.'

  return (
    <Card className="border-amber-200 bg-amber-50/70 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <Lock aria-hidden className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Cancellation locked</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800/80 dark:text-amber-200/80">
            {message}
          </p>
        </div>
      </div>
    </Card>
  )
}

function RouteProgress({
  pickup,
  destination,
  statusLabel,
}: {
  pickup: string
  destination: string
  statusLabel: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Status</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-white" />
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex items-stretch gap-3.5">
        <div className="flex flex-col items-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            <MapPin aria-hidden className="size-4.5" />
          </span>
          <span aria-hidden className="w-0.5 flex-1 border-l-2 border-dashed border-ink-300 dark:border-slate-700" />
          <span className="flex size-9 items-center justify-center rounded-full bg-ink-900 text-white">
            <MapPin aria-hidden className="size-4.5" />
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-between py-1.5">
          <div>
            <p className="text-sm font-semibold text-ink-800 dark:text-slate-200">{pickup}</p>
            <p className="text-xs text-ink-400 dark:text-slate-500">Pickup point</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-800 dark:text-slate-200">{destination}</p>
            <p className="text-xs text-ink-400 dark:text-slate-500">Destination</p>
          </div>
        </div>
      </div>
    </Card>
  )
}