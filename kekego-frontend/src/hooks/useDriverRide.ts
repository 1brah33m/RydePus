import { useCallback, useEffect, useState } from 'react'
import type { Payment, Trip } from '../types'
import { tripService } from '../services/tripService'
import { paymentService } from '../services/paymentService'
import { driverService } from '../services/driverService'
import type { DriverProfile, PayoutDetails } from '../services/driverService'

/**
 * Driver-side dashboard state — fully backed by the Django API.
 *
 * Polls the driver's profile, the open request queue, the assigned/current
 * ride, the ride history and the fares students say they have paid, and
 * exposes the accept → start → complete lifecycle actions. Payments settle on
 * the student's side, so there is nothing here for the driver to confirm.
 */
export function useDriverRide() {
  const [profile, setProfile] = useState<DriverProfile | null>(null)
  const [requests, setRequests] = useState<Trip[]>([])
  const [assigned, setAssigned] = useState<Trip[]>([])
  const [history, setHistory] = useState<Trip[]>([])
  const [collectable, setCollectable] = useState<Payment[]>([])
  const [refreshing, setRefreshing] = useState(true)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [p, req, ass, hist, pay] = await Promise.all([
        driverService.getProfile(),
        tripService.getAvailableTrips(),
        tripService.getAssignedTrips(),
        tripService.getDriverHistory(),
        // Kept fault-tolerant so a payments hiccup cannot blank the whole dashboard.
        paymentService.getCollectablePayments().catch(() => []),
      ])
      setProfile(p)
      setRequests(req)
      setAssigned(ass)
      setHistory(hist)
      setCollectable(pay)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh().catch(() => {
      // transient failures are retried by the interval
    })
    const timer = setInterval(() => {
      void refresh().catch(() => {
        // keep polling
      })
    }, 10_000)
    return () => clearInterval(timer)
  }, [refresh])

  const online = profile ? profile.availability_status !== 'OFFLINE' : false

  const setOnline = useCallback(
    async (next: boolean) => {
      await driverService.updateAvailability({ availability_status: next ? 'ONLINE' : 'OFFLINE' })
      await refresh()
    },
    [refresh],
  )

  const accept = useCallback(
    async (tripId: string) => {
      setBusy(true)
      try {
        await tripService.acceptTrip(tripId)
        await refresh()
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const start = useCallback(
    async (tripId: string) => {
      setBusy(true)
      try {
        await tripService.updateTripStatus(tripId, 'start')
        await refresh()
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const complete = useCallback(
    async (tripId: string) => {
      setBusy(true)
      try {
        await tripService.updateTripStatus(tripId, 'complete')
        await refresh()
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  /** Save the bank account ride fares are transferred to. */
  const savePayoutDetails = useCallback(
    async (details: PayoutDetails) => {
      await driverService.updatePayoutDetails(details)
      await refresh()
    },
    [refresh],
  )

  /** The trip the driver is currently assigned to (accepted or in progress). */
  const activeTrip: Trip | null =
    assigned.find((t) => t.status === 'DRIVER_ACCEPTED' || t.status === 'IN_PROGRESS') ?? null

  const completedTotal = history
    .filter((t) => t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.fare, 0)

  /** Total settled fares on this driver's rides. */
  const collectedTotal = collectable
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount, 0)

  return {
    profile,
    refreshing,
    online,
    requests,
    activeTrip,
    history,
    collectable,
    collectedTotal,
    busy,
    completedTotal,
    setOnline,
    accept,
    start,
    complete,
    savePayoutDetails,
    refresh,
  }
}