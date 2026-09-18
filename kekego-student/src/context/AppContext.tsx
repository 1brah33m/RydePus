import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import type {
  CampusLocation,
  Driver,
  Group,
  GroupMember,
  Payment,
  Student,
  Trip,
} from '../types'
import { CURRENCY, FARE_PER_SEAT, MOCK_STUDENTS } from '../mock/data'
import * as backend from '../services/mockBackend'
import { groupService } from '../services/groupService'
import { tripService } from '../services/tripService'
import { paymentService } from '../services/paymentService'
import { dispatchService } from '../services/dispatchService'
import { useAuth } from './AuthContext'

/**
 * Application state provider.
 *
 * The UI is a pure mirror of the mock backend store — business decisions
 * (capacity, status transitions, driver matching) happen inside the mock
 * backend, exactly as they will on a real server.
 *
 * A lightweight simulation advances group/trip lifecycle states over time so
 * the prototype behaves like a live application.
 */

interface AppState {
  groups: Group[]
  trips: Trip[]
  payments: Payment[]

  /** Group the signed-in student is currently participating in. */
  activeGroupId: string | null
  /** Active trip for the student (a group that has been matched to a driver). */
  activeTripId: string | null
}

type AppAction = { type: 'REPLACE'; state: AppState }

function reducer(_state: AppState, action: AppAction): AppState {
  return action.state
}

/* ------------------------------------------------------------------ */
/* Active-selection persistence                                        */
/* ------------------------------------------------------------------ */

const ACTIVE_KEY = 'transitx.active.v1'

function readActiveRaw(): { activeGroupId: string | null; activeTripId: string | null } {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { activeGroupId?: string; activeTripId?: string }
      return {
        activeGroupId: parsed.activeGroupId ?? null,
        activeTripId: parsed.activeTripId ?? null,
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return { activeGroupId: null, activeTripId: null }
}

function writeActiveRaw(activeGroupId: string | null, activeTripId: string | null): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ activeGroupId, activeTripId }))
  } catch {
    // ignore
  }
}

function buildState(): AppState {
  const db = backend.getDb()
  const raw = readActiveRaw()
  const validGroupId = raw.activeGroupId && db.groups.some((g) => g.id === raw.activeGroupId) ? raw.activeGroupId : null
  const validTripId = raw.activeTripId && db.trips.some((t) => t.id === raw.activeTripId) ? raw.activeTripId : null
  return {
    groups: db.groups,
    trips: db.trips,
    payments: db.payments,
    activeGroupId: validGroupId,
    activeTripId: validTripId,
  }
}

/* ------------------------------------------------------------------ */
/* Simulation tuning                                                   */
/* ------------------------------------------------------------------ */

const GHOST_JOIN_INTERVAL = 8000
const FULL_TO_SEARCHING_DELAY = 2500
const SEARCH_TO_DRIVER_DELAY = 9000
const DRIVER_ASSIGNED_DELAY = 25000
const DRIVER_ACCEPTED_DELAY = 20000
const IN_TRIP_DELAY = 90000
const BACKGROUND_TICK = 15000

const GHOST_NAMES = ['Yusuf K.', 'Funke A.', 'Kelechi O.', 'Chioma N.', 'John P.', 'Blessing T.', 'Ibrahim S.']

function ghostMemberFor(group: Group): GroupMember {
  const taken = new Set(group.members.map((m) => m.name))
  const candidates = [...GHOST_NAMES, ...MOCK_STUDENTS.map((s) => s.fullName)].filter((n) => !taken.has(n))
  const name = candidates[Math.floor(Math.random() * candidates.length)] ?? 'Student'
  return { id: crypto.randomUUID(), name, seats: 1 }
}

function makeMember(student: Student, seats: number): GroupMember {
  return { id: crypto.randomUUID(), name: student.fullName, seats, isCurrentUser: true }
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
  createGroup: (pickup: CampusLocation, destination: CampusLocation, seats: number) => Promise<Group>
  joinGroup: (groupId: string) => Promise<Group>
  cancelGroup: (groupId: string) => Promise<void>
  leaveGroup: (groupId: string) => Promise<void>
  payForFourSeats: (
    pickup: CampusLocation,
    destination: CampusLocation,
    method: string,
  ) => Promise<{ group: Group; payment: Payment }>
  buyOutRemainingSeats: (
    groupId: string,
    method: string,
  ) => Promise<{ group: Group; payment: Payment; seatsBought: number; amount: number }>
  cancelTrip: (tripId: string) => Promise<Trip>
  submitRating: (tripId: string, rating: number, comment?: string) => Promise<void>
  settleActivity: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, student } = useAuth()
  const authenticated = authStatus === 'authenticated'

  const [state, dispatch] = useReducer(reducer, undefined, buildState)

  const activeGroupIdRef = useRef<string | null>(null)
  useEffect(() => {
    activeGroupIdRef.current = state.activeGroupId
  }, [state.activeGroupId])

  const sync = useCallback(() => {
    dispatch({ type: 'REPLACE', state: buildState() })
  }, [])

  const setSelection = useCallback(
    (activeGroupId: string | null, activeTripId: string | null) => {
      writeActiveRaw(activeGroupId, activeTripId)
      sync()
    },
    [sync],
  )

  /* When signed out, clear the persisted active group/trip selection. */
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      writeActiveRaw(null, null)
      sync()
    }
  }, [authStatus, sync])

  /* Persist selection changes. */
  useEffect(() => {
    writeActiveRaw(state.activeGroupId, state.activeTripId)
  }, [state.activeGroupId, state.activeTripId])

  /* ---------------------------------------------------------------- */
  /* Exposed API                                                       */
  /* ---------------------------------------------------------------- */

  const requireStudent = useCallback((): Student => {
    if (!student) throw new Error('You must be signed in to do that.')
    return student
  }, [student])

  const createGroup = useCallback(
    async (pickup: CampusLocation, destination: CampusLocation, seats: number): Promise<Group> => {
      const current = requireStudent()
      const active = backend.getGroups().find((g) => g.id === activeGroupIdRef.current)
      if (activeGroupIdRef.current && active) {
        throw new Error(
          `You are already part of an active group (${active.code}). You must leave your current group before creating a new one.`,
        )
      }
      const member = makeMember(current, seats)
      const group = await groupService.createGroup({ pickup, destination: destination, member })
      setSelection(group.id, null)
      return group
    },
    [requireStudent, setSelection],
  )

  const joinGroup = useCallback(
    async (groupId: string): Promise<Group> => {
      const current = requireStudent()
      const existing = backend
        .getGroups()
        .find((g) => g.id === groupId)
      if (!existing) throw new Error('Group not found.')
      const active = backend.getGroups().find((g) => g.id === activeGroupIdRef.current)
      if (activeGroupIdRef.current && active && active.id !== groupId) {
        throw new Error(
          `You are already part of an active group (${active.code}). You must leave your current group before joining a new one.`,
        )
      }
      if (existing.members.some((m) => m.isCurrentUser)) {
        setSelection(existing.id, null)
        return existing
      }
      if (existing.status !== 'WAITING') {
        throw new Error('This group is no longer accepting passengers.')
      }
      const updated = await groupService.joinGroup(groupId, makeMember(current, 1))
      setSelection(updated.id, null)
      return updated
    },
    [requireStudent, setSelection],
  )

  const cancelGroup = useCallback(
    async (groupId: string): Promise<void> => {
      await groupService.cancelGroup(groupId)
      setSelection(null, null)
    },
    [setSelection],
  )

  const leaveGroup = useCallback(
    async (groupId: string): Promise<void> => {
      await groupService.leaveGroup(groupId)
      // Clear the ref synchronously so a follow-up join/create is not blocked.
      activeGroupIdRef.current = null
      setSelection(null, null)
    },
    [setSelection],
  )

  const payForFourSeats = useCallback(
    async (pickup: CampusLocation, destination: CampusLocation, method: string) => {
      const current = requireStudent()
      const active = backend.getGroups().find((g) => g.id === activeGroupIdRef.current)
      if (activeGroupIdRef.current && active) {
        throw new Error(
          `You are already part of an active group (${active.code}). You must leave your current group before starting a new one.`,
        )
      }
      const result = await paymentService.processPayment({
        amount: FARE_PER_SEAT * 4,
        seats: 4,
        currency: CURRENCY,
        method,
        metadata: { pickupId: pickup.id, destinationId: destination.id },
      })
      if (result.status !== 'SUCCESS') {
        throw new Error('Payment was not successful. Please try again.')
      }
      const member = makeMember(current, 4)
      const group = await groupService.createGroup({ pickup, destination, member })
      const full = await groupService.updateStatus(group.id, 'FULL')
      setSelection(full.id, null)
      return { group: full, payment: result.payment }
    },
    [requireStudent, setSelection],
  )

  const buyOutRemainingSeats = useCallback(
    async (groupId: string, method: string) => {
      const current = requireStudent()
      const existing = backend.getGroups().find((g) => g.id === groupId)
      if (!existing) throw new Error('Group not found.')
      const occupied = backend.groupSeatCount(existing)
      const remaining = existing.maxSize - occupied
      if (existing.status !== 'WAITING' || remaining <= 0) {
        throw new Error('This group no longer needs extra seats.')
      }
      const amount = remaining * FARE_PER_SEAT
      // Simulate a successful instant payment (demo — no provider involved).
      const payment: Payment = {
        id: crypto.randomUUID(),
        reference: `REF-${Date.now().toString(36).toUpperCase()}`,
        groupId,
        amount,
        seats: remaining,
        currency: CURRENCY,
        status: 'SUCCESS',
        method,
        createdAt: new Date().toISOString(),
      }
      backend.addPayment(payment)
      const filled = await groupService.buyOutRemainingSeats(groupId, remaining, makeMember(current, remaining))
      await dispatchService.dispatchFullyFundedGroup(filled, amount)
      setSelection(filled.id, null)
      return { group: filled, payment, seatsBought: remaining, amount }
    },
    [requireStudent, setSelection],
  )

  const cancelTrip = useCallback(
    async (tripId: string): Promise<Trip> => {
      const trip = await tripService.cancelTrip(tripId)
      setSelection(null, null)
      return trip
    },
    [setSelection],
  )

  const submitRating = useCallback(
    async (tripId: string, rating: number, comment?: string) => {
      await tripService.submitRating(tripId, rating, comment)
      sync()
    },
    [sync],
  )

  const settleActivity = useCallback(() => {
    setSelection(null, null)
  }, [setSelection])

  /* ---------------------------------------------------------------- */
  /* Derived values                                                    */
  /* ---------------------------------------------------------------- */

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
          g.pickup.id === pickupId &&
          g.destination.id === destinationId &&
          (g.status === 'WAITING' || g.status === 'FULL' || g.status === 'SEARCHING_DRIVER'),
      ),
    [state.activeGroupId, state.groups],
  )

  const pendingGroups = useMemo(
    () =>
      state.groups
        .filter(
          (g) =>
            g.id !== state.activeGroupId &&
            (g.status === 'WAITING' || g.status === 'FULL' || g.status === 'SEARCHING_DRIVER'),
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, 4),
    [state.activeGroupId, state.groups],
  )

  const allPendingGroups = useMemo(
    () =>
      state.groups
        .filter(
          (g) =>
            g.id !== state.activeGroupId &&
            (g.status === 'WAITING' || g.status === 'FULL' || g.status === 'SEARCHING_DRIVER'),
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [state.activeGroupId, state.groups],
  )

  const getDriverById = useCallback(
    (driverId: string): Driver | null => backend.getDrivers().find((d) => d.id === driverId) ?? null,
    [],
  )

  /* ---------------------------------------------------------------- */
  /* Simulation: user's group fills -> full -> driver search -> trip   */
  /* ---------------------------------------------------------------- */

  const addGhostPassenger = useCallback(
    async (groupId: string) => {
      const group = backend.getGroups().find((g) => g.id === groupId)
      if (!group) return
      if (backend.groupSeatCount(group) >= group.maxSize) return
      await groupService.simulatePassengerJoin(groupId, ghostMemberFor(group))
      sync()
    },
    [sync],
  )

  useEffect(() => {
    if (!authenticated || !activeGroup) return
    const occupied = backend.groupSeatCount(activeGroup)
    if (activeGroup.status !== 'WAITING' || occupied >= activeGroup.maxSize) return

    const timer = setInterval(() => {
      void addGhostPassenger(activeGroup.id)
    }, GHOST_JOIN_INTERVAL)
    return () => clearInterval(timer)
  }, [authenticated, activeGroup, addGhostPassenger])

  useEffect(() => {
    if (!authenticated || !activeGroup || activeGroup.status !== 'FULL') return
    const timer = setTimeout(async () => {
      try {
        const updated = await groupService.updateStatus(activeGroup.id, 'SEARCHING_DRIVER')
        void updated
        sync()
      } catch {
        // keep current state
      }
    }, FULL_TO_SEARCHING_DELAY)
    return () => clearTimeout(timer)
  }, [authenticated, activeGroup, sync])

  const assignDriverToGroup = useCallback(
    async (group: Group) => {
      try {
        const trip = await tripService.assignDriver(group)
        const updated = await groupService.updateStatus(group.id, 'DRIVER_ASSIGNED')
        setSelection(updated.id, trip.id)
      } catch {
        // matching failed transiently; the effect will retry on next state change
      }
    },
    [setSelection],
  )

  useEffect(() => {
    if (!authenticated || !activeGroup || activeGroup.status !== 'SEARCHING_DRIVER') return
    const timer = setTimeout(() => {
      void assignDriverToGroup(activeGroup)
    }, SEARCH_TO_DRIVER_DELAY)
    return () => clearTimeout(timer)
  }, [authenticated, activeGroup, assignDriverToGroup])

  /* ---------------------------------------------------------------- */
  /* Simulation: trip lifecycle                                        */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!authenticated || !activeTrip) return
    let timer: ReturnType<typeof setTimeout> | null = null

    if (activeTrip.status === 'DRIVER_ASSIGNED') {
      timer = setTimeout(async () => {
        await tripService.updateStatus(activeTrip.id, 'DRIVER_ACCEPTED')
        sync()
      }, DRIVER_ASSIGNED_DELAY)
    } else if (activeTrip.status === 'DRIVER_ACCEPTED') {
      timer = setTimeout(async () => {
        await tripService.updateStatus(activeTrip.id, 'IN_PROGRESS')
        sync()
      }, DRIVER_ACCEPTED_DELAY)
    } else if (activeTrip.status === 'IN_PROGRESS') {
      timer = setTimeout(async () => {
        await tripService.updateStatus(activeTrip.id, 'COMPLETED')
        const group = backend.getGroups().find((g) => g.id === activeTrip.groupId)
        if (group) backend.setGroupStatus(group.id, 'COMPLETED')
        sync()
      }, IN_TRIP_DELAY)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [authenticated, activeTrip, sync])

  /* ---------------------------------------------------------------- */
  /* Background simulation: other pending groups across campus         */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!authenticated) return
    const tick = () => {
      let changed = false
      const groups = backend.getGroups()
      for (const group of groups) {
        if (group.id === activeGroupIdRef.current) continue
        if (group.status === 'WAITING') {
          const occupied = backend.groupSeatCount(group)
          if (occupied < group.maxSize && Math.random() < 0.35) {
            backend.addGroupMember(group.id, ghostMemberFor(group))
            changed = true
          }
        } else if (group.status === 'FULL' && Math.random() < 0.3) {
          backend.setGroupStatus(group.id, 'SEARCHING_DRIVER')
          changed = true
        } else if (group.status === 'SEARCHING_DRIVER' && Math.random() < 0.35) {
          backend.removeGroup(group.id)
          changed = true
        }
      }
      if (changed) sync()
    }
    const timer = setInterval(tick, BACKGROUND_TICK)
    return () => clearInterval(timer)
  }, [authenticated, sync])

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
      payForFourSeats,
      buyOutRemainingSeats,
      cancelTrip,
      submitRating,
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
      payForFourSeats,
      buyOutRemainingSeats,
      cancelTrip,
      submitRating,
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