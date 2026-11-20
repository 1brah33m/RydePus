import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Payment, Trip } from '../types'
import { tripService } from '../services/tripService'
import { paymentService } from '../services/paymentService'
import { driverService } from '../services/driverService'
import type { DriverProfile, PayoutDetails } from '../services/driverService'
import { useAuth } from './AuthContext'

const ONLINE_CACHE_KEY = 'rydepus.driver.online.v1'

function readCachedOnline(): boolean {
  try {
    return localStorage.getItem(ONLINE_CACHE_KEY) === '1'
  } catch {
    return false
  }
}

function writeCachedOnline(next: boolean): void {
  try {
    localStorage.setItem(ONLINE_CACHE_KEY, next ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
}

interface DriverRideContextValue {
  profile: DriverProfile | null
  refreshing: boolean
  online: boolean
  requests: Trip[]
  activeTrip: Trip | null
  history: Trip[]
  collectable: Payment[]
  collectedTotal: number
  busy: boolean
  completedTotal: number
  setOnline: (next: boolean) => Promise<void>
  accept: (tripId: string) => Promise<void>
  start: (tripId: string) => Promise<void>
  complete: (tripId: string) => Promise<void>
  savePayoutDetails: (details: PayoutDetails) => Promise<void>
  refresh: () => Promise<void>
}

const DriverRideContext = createContext<DriverRideContextValue | null>(null)

/**
 * Shared driver dashboard state. Mounted once around all driver routes so the
 * online/offline toggle survives page-to-page navigation.
 *
 * Each driver page previously called its own `useDriverRide()` with local
 * `profile = null` state, so `online` read as `false` on every navigation
 * until the profile refetched — the toggle visibly snapped off and back on.
 * A single provider keeps one profile + one poller, and seeds `online` from a
 * local cache so the toggle stays on while the fresh profile loads.
 */
export function DriverRideProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const authenticated = status === 'authenticated'

  const [profile, setProfile] = useState<DriverProfile | null>(null)
  const [requests, setRequests] = useState<Trip[]>([])
  const [assigned, setAssigned] = useState<Trip[]>([])
  const [history, setHistory] = useState<Trip[]>([])
  const [collectable, setCollectable] = useState<Payment[]>([])
  const [refreshing, setRefreshing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [cachedOnline, setCachedOnline] = useState<boolean>(() => readCachedOnline())

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [p, req, ass, hist, pay] = await Promise.all([
        driverService.getProfile(),
        // The queue endpoint rejects with 400 while the driver is offline. Treat
        // that as an empty queue so one offline read cannot reject the whole
        // batch and freeze the online/offline toggle.
        tripService.getAvailableTrips().catch(() => []),
        tripService.getAssignedTrips(),
        tripService.getDriverHistory(),
        // Kept fault-tolerant so a payments hiccup cannot blank the whole dashboard.
        paymentService.getCollectablePayments().catch(() => []),
      ])
      setProfile(p)
      const isOnline = p.availability_status !== 'OFFLINE'
      setCachedOnline(isOnline)
      writeCachedOnline(isOnline)
      setRequests(req)
      setAssigned(ass)
      setHistory(hist)
      setCollectable(pay)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!authenticated) {
      setProfile(null)
      setRequests([])
      setAssigned([])
      setHistory([])
      setCollectable([])
      setCachedOnline(false)
      return
    }

    let cancelled = false
    void refresh().catch(() => {
      if (!cancelled) setRefreshing(false)
    })
    const timer = setInterval(() => {
      void refresh().catch(() => {
        // keep polling
      })
    }, 10_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [authenticated, refresh])

  // Authoritative once the profile has loaded; cached while it (re)loads so
  // navigating Home -> Earnings never flashes the toggle off.
  const online = profile ? profile.availability_status !== 'OFFLINE' : cachedOnline

  const setOnline = useCallback(
    async (next: boolean) => {
      const prevCached = readCachedOnline()
      // Optimistic: keep the toggle on across pages even before refresh lands.
      setCachedOnline(next)
      writeCachedOnline(next)
      setProfile((prev) =>
        prev ? { ...prev, availability_status: next ? 'ONLINE' : 'OFFLINE' } : prev,
      )
      try {
        const updated = await driverService.updateAvailability({
          availability_status: next ? 'ONLINE' : 'OFFLINE',
        })
        setProfile(updated)
        const confirmed = updated.availability_status !== 'OFFLINE'
        setCachedOnline(confirmed)
        writeCachedOnline(confirmed)
      } catch {
        // Roll back the optimistic flip so a failed request never leaves the
        // toggle stuck in the wrong state; refresh then confirms authority.
        setCachedOnline(prevCached)
        writeCachedOnline(prevCached)
        await refresh().catch(() => undefined)
        throw new Error('Could not update availability. Please try again.')
      }
      await refresh().catch(() => undefined)
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

  const savePayoutDetails = useCallback(
    async (details: PayoutDetails) => {
      await driverService.updatePayoutDetails(details)
      await refresh()
    },
    [refresh],
  )

  const activeTrip: Trip | null =
    assigned.find((t) => t.status === 'DRIVER_ACCEPTED' || t.status === 'IN_PROGRESS') ?? null

  const completedTotal = history
    .filter((t) => t.status === 'COMPLETED')
    .reduce((sum, t) => sum + (t.fareTotal ?? t.fare * (t.passengerCount ?? 1)), 0)

  const collectedTotal = collectable
    .filter((p) => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount, 0)

  const value = useMemo<DriverRideContextValue>(
    () => ({
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
    }),
    [
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
    ],
  )

  return <DriverRideContext.Provider value={value}>{children}</DriverRideContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook export by design
export function useDriverRideContext(): DriverRideContextValue {
  const ctx = useContext(DriverRideContext)
  if (!ctx) throw new Error('useDriverRideContext must be used within a DriverRideProvider')
  return ctx
}
