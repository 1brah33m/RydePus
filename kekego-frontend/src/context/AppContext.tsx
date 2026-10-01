import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  CampusLocation,
  Driver,
  Group,
  Payment,
  PaymentMethod,
  Student,
  Trip,
  TripStatus,
} from '../types'
import { groupService } from '../services/groupService'
import { tripService } from '../services/tripService'
import { paymentService } from '../services/paymentService'
import { perSeatFare } from '../config/pricing'
import { useAuth } from './AuthContext'

/**
 * Application state provider.
 *
 * The UI is a pure mirror of the Django API — groups, trips and payments are
 * fetched on mount and refreshed on an interval and after every mutation.
 * No client-side simulation runs: the backend owns capacity, status
 * transitions and rider lifecycle.
 */

interface AppState {
  groups: Group[]
  trips: Trip[]
  payments: Payment[]
  activeGroupId: string | null
  activeTripId: string | null
}

const EMPTY_STATE: AppState = {
  groups: [],
  trips: [],
  payments: [],
  activeGroupId: null,
  activeTripId: null,
}

/* ------------------------------------------------------------------ */
/* Active-selection persistence                                        */
/* ------------------------------------------------------------------ */

const ACTIVE_KEY = 'transitx.active.v1'

export function writeActiveRaw(activeGroupId: string | null, activeTripId: string | null): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ activeGroupId, activeTripId }))
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/* Status helpers                                                      */
/* ------------------------------------------------------------------ */

const OPEN_GROUP_STATUSES: ReadonlySet<Group['status']> = new Set([
  'WAITING',
  'FULL',
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'DRIVER_ACCEPTED',
  'IN_TRIP',
])

/** A richer group status derived from the group's linked trip (if any). */
function decorateGroup(group: Group, trip?: Trip): Group {
  if (!trip) return group
  const map: Partial<Record<TripStatus, Group['status']>> = {
    DRIVER_ACCEPTED: 'DRIVER_ACCEPTED',
    IN_PROGRESS: 'IN_TRIP',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    PENDING: group.status === 'FULL' ? 'SEARCHING_DRIVER' : 'WAITING',
  }
  const enriched = map[trip.status] ?? group.status
  return enriched === group.status ? group : { ...group, status: enriched, tripId: trip.id }
}

/** Pick the valid active selection from the current data. */
function deriveSelection(
  groups: Group[],
  trips: Trip[],
  prev: { activeGroupId: string | null; activeTripId: string | null },
  currentMemberId?: string,
): { activeGroupId: string | null; activeTripId: string | null } {
  const isMember = (g: Group) =>
    Boolean(currentMemberId) && g.members.some((m) => m.isCurrentUser)

  let activeGroupId = prev.activeGroupId
  const group = groups.find((g) => g.id === activeGroupId)
  if (!group || !OPEN_GROUP_STATUSES.has(group.status)) {
    activeGroupId = groups.find((g) => OPEN_GROUP_STATUSES.has(g.status) && isMember(g))?.id ?? null
  }

  let activeTripId: string | null = null
  if (activeGroupId) {
    const openTrip = trips.find(
      (t) => t.groupId === activeGroupId && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
    )
    activeTripId = openTrip?.id ?? null
  }
  return { activeGroupId, activeTripId }
}

interface AppContextValue {
  state: AppState
  activeGroup: Group | null
  activeTrip: Trip | null
  payments: Payment[]
  groupsByRoute: (pickupId: string, destinationId: string) => Group[]
  pendingGroups: Group[]
  allPendingGroups: Group[]
  getDriverById: (driverId: string) => Driver | null
  createGroup: (pickup: CampusLocation, destination: CampusLocation) => Promise<Group>
  joinGroup: (groupId: string) => Promise<Group>
  cancelGroup: (groupId: string) => Promise<void>
  leaveGroup: (groupId: string) => Promise<void>
  /**
   * Pay for every empty seat in a group so it can leave immediately.
   * Resolves with the total charged.
   */
  buyOutGroup: (groupId: string) => Promise<number>
  cancelTrip: (tripId: string) => Promise<Trip>
  submitRating: (tripId: string, rating: number, comment?: string) => Promise<void>
  payForTrip: (tripId: string, method: PaymentMethod) => Promise<Payment>
  settleActivity: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, role, student } = useAuth()
  const authenticated = authStatus === 'authenticated' && role === 'student'

  const [state, setState] = useState<AppState>(EMPTY_STATE)

  const currentMemberId = student?.id

  /* ------------------------------------------------------------------ */
  /* Dispatch                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Send a group's ride request to the driver queue, but only once all four
   * seats are accounted for by members or by a buyout. Safe to call
   * repeatedly: an existing trip is reused, and the backend rejects duplicates.
   */
  const dispatchGroup = useCallback(async (group: Group, knownTrips: Trip[]): Promise<Trip | null> => {
    if (!group.isDispatchable) return null
    const existing = knownTrips.find(
      (t) => t.groupId === group.id && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
    )
    if (existing) return existing

    try {
      return await tripService.createTrip({
        groupId: group.id,
        pickup: group.pickup,
        destination: group.destination,
        fare: perSeatFare(group.pickup.id, group.destination.id),
      })
    } catch {
      // Another member dispatched first, or the group changed underneath us.
      return null
    }
  }, [])

  /* ------------------------------------------------------------------ */
  /* Refresh from the API                                                */
  /* ------------------------------------------------------------------ */

  const refresh = useCallback(async () => {
    const [groups, trips, payments] = await Promise.all([
      groupService.getGroups(currentMemberId),
      tripService.getTrips(),
      paymentService.getPayments(),
    ])

    // Safety net: a group of mine that is full (4/4, or bought out) but has no
    // ride request yet — e.g. whoever closed the last seat went offline.
    const undispatched = groups.filter(
      (g) => g.isDispatchable && g.members.some((m) => m.isCurrentUser),
    )
    const dispatched = await Promise.all(undispatched.map((g) => dispatchGroup(g, trips)))
    const finalTrips = dispatched.some(Boolean) ? await tripService.getTrips() : trips

    const decorated = groups.map((g) => decorateGroup(g, finalTrips.find((t) => t.groupId === g.id)))

    setState((prev) => {
      const prevSelection = { activeGroupId: prev.activeGroupId, activeTripId: prev.activeTripId }
      const next = deriveSelection(decorated, finalTrips, prevSelection, currentMemberId)
      writeActiveRaw(next.activeGroupId, next.activeTripId)
      return { groups: decorated, trips: finalTrips, payments, ...next }
    })
  }, [currentMemberId, dispatchGroup])

  useEffect(() => {
    if (!authenticated) {
      // Reset on sign-out, derived from `authenticated` so a logout does not
      // schedule a second render pass.
      const frame = requestAnimationFrame(() => {
        setState(EMPTY_STATE)
        writeActiveRaw(null, null)
      })
      return () => cancelAnimationFrame(frame)
    }

    let cancelled = false
    void refresh().catch(() => {
      if (!cancelled) setState(EMPTY_STATE)
    })
    const timer = setInterval(() => {
      void refresh().catch(() => {
        // transient network issues are fine; the next tick retries
      })
    }, 15_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [authenticated, refresh])

  /* ------------------------------------------------------------------ */
  /* Exposed API                                                         */
  /* ------------------------------------------------------------------ */

  const requireStudent = useCallback((): Student => {
    if (!student || role !== 'student') throw new Error('You must be signed in as a student to do that.')
    return student
  }, [student, role])

  const createGroup = useCallback(
    async (pickup: CampusLocation, destination: CampusLocation): Promise<Group> => {
      requireStudent()
      if (state.activeGroupId) {
        const active = state.groups.find((g) => g.id === state.activeGroupId)
        throw new Error(
          `You are already part of an active group (${active?.code ?? 'open'}). You must leave your current group before creating a new one.`,
        )
      }
      const group = await groupService.createGroup({ pickup, destination }, currentMemberId)
      writeActiveRaw(group.id, null)
      await refresh()
      return group
    },
    [requireStudent, state.activeGroupId, state.groups, currentMemberId, refresh],
  )

  const joinGroup = useCallback(
    async (groupId: string): Promise<Group> => {
      requireStudent()
      if (state.activeGroupId && state.activeGroupId !== groupId) {
        const active = state.groups.find((g) => g.id === state.activeGroupId)
        throw new Error(
          `You are already part of an active group (${active?.code ?? 'open'}). You must leave your current group before joining a new one.`,
        )
      }
      const group = await groupService.joinGroup(groupId, currentMemberId)
      // The group may have just filled up with this join, in which case the
      // ride request goes out right away.
      if (group.isDispatchable) {
        await dispatchGroup(group, state.trips)
      }
      writeActiveRaw(group.id, null)
      await refresh()
      return group
    },
    [requireStudent, state.activeGroupId, state.groups, state.trips, currentMemberId, refresh, dispatchGroup],
  )

  const cancelGroup = useCallback(
    async (groupId: string): Promise<void> => {
      await groupService.cancelGroup(groupId)
      writeActiveRaw(null, null)
      await refresh()
    },
    [refresh],
  )

  const leaveGroup = useCallback(
    async (groupId: string): Promise<void> => {
      await groupService.leaveGroup(groupId)
      writeActiveRaw(null, null)
      await refresh()
    },
    [refresh],
  )

  const buyOutGroup = useCallback(
    async (groupId: string): Promise<number> => {
      requireStudent()
      const group = state.groups.find((g) => g.id === groupId)
      if (!group) throw new Error('We could not find this group.')
      if (!group.members.some((m) => m.isCurrentUser)) {
        throw new Error('You must be in the group to fill its empty seats.')
      }

      const remaining = group.maxSize - group.seatsFilled
      if (remaining <= 0) throw new Error('This group already has all of its seats taken.')

      const amount = perSeatFare(group.pickup.id, group.destination.id) * remaining
      await groupService.buyOutSeats(group.id, remaining, amount)

      const updated = await groupService.getGroups(currentMemberId)
      const fresh = updated.find((g) => g.id === groupId)
      if (fresh?.isDispatchable) {
        await dispatchGroup(fresh, state.trips)
      }
      await refresh()
      return amount
    },
    [requireStudent, state.groups, state.trips, currentMemberId, refresh, dispatchGroup],
  )

  const cancelTrip = useCallback(
    async (tripId: string): Promise<Trip> => {
      const trip = await tripService.cancelTrip(tripId)
      writeActiveRaw(null, null)
      await refresh()
      return trip
    },
    [refresh],
  )

  const submitRating = useCallback(
    async (tripId: string, rating: number, comment?: string): Promise<void> => {
      await tripService.submitRating(tripId, rating, comment)
      await refresh()
    },
    [refresh],
  )

  const payForTrip = useCallback(
    async (tripId: string, method: PaymentMethod): Promise<Payment> => {
      const trip = state.trips.find((t) => t.id === tripId)
      if (!trip) throw new Error('We could not find this trip.')
      const payment = await paymentService.processPayment({
        tripId,
        amount: trip.fare,
        method,
      })
      await refresh()
      return payment
    },
    [state.trips, refresh],
  )

  const settleActivity = useCallback(() => {
    writeActiveRaw(null, null)
    setState((prev) => ({ ...prev, activeGroupId: null, activeTripId: null }))
  }, [])

  /* ------------------------------------------------------------------ */
  /* Derived values                                                      */
  /* ------------------------------------------------------------------ */

  const activeGroup = useMemo(
    () => state.groups.find((g) => g.id === state.activeGroupId) ?? null,
    [state.activeGroupId, state.groups],
  )
  const activeTrip = useMemo(
    () => state.trips.find((t) => t.id === state.activeTripId) ?? null,
    [state.activeTripId, state.trips],
  )

  const groupsByRoute = useCallback(
    (pickupId: string, destinationId: string): Group[] =>
      state.groups.filter(
        (g) =>
          g.id !== state.activeGroupId &&
          OPEN_GROUP_STATUSES.has(g.status) &&
          g.pickup.id === pickupId &&
          g.destination.id === destinationId,
      ),
    [state.activeGroupId, state.groups],
  )

  const pendingGroups = useMemo(
    () =>
      state.groups
        .filter((g) => g.id !== state.activeGroupId && OPEN_GROUP_STATUSES.has(g.status))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, 4),
    [state.activeGroupId, state.groups],
  )

  const allPendingGroups = useMemo(
    () =>
      state.groups
        .filter((g) => g.id !== state.activeGroupId && OPEN_GROUP_STATUSES.has(g.status))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [state.activeGroupId, state.groups],
  )

  const getDriverById = useCallback(
    (driverId: string): Driver | null => {
      for (const trip of state.trips) {
        if (trip.driver?.id === driverId) return trip.driver
      }
      return null
    },
    [state.trips],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      activeGroup,
      activeTrip,
      payments: state.payments,
      groupsByRoute,
      pendingGroups,
      allPendingGroups,
      getDriverById,
      createGroup,
      joinGroup,
      cancelGroup,
      leaveGroup,
      buyOutGroup,
      cancelTrip,
      submitRating,
      payForTrip,
      settleActivity,
    }),
    [
      state,
      activeGroup,
      activeTrip,
      groupsByRoute,
      pendingGroups,
      allPendingGroups,
      getDriverById,
      createGroup,
      joinGroup,
      cancelGroup,
      leaveGroup,
      buyOutGroup,
      cancelTrip,
      submitRating,
      payForTrip,
      settleActivity,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook export by design
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an AppProvider')
  return ctx
}