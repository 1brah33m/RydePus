import { MAX_GROUP_SIZE, seedGroups, seedTrips, MOCK_DRIVERS } from '../mock/data'
import { isGroupAccepted, isTripAccepted } from '../utils/rideStatus'
import type {
  Trip,
  Group,
  Payment,
  Student,
  Driver,
  UserRole,
  CampusLocation,
  GroupMember,
  DriverDispatch,
} from '../types'

/**
 * Mock backend store.
 *
 * This module plays the role of the remote backend for the MVP prototype:
 * it holds state, owns business rules (capacity, status transitions) and
 * persists to localStorage so state survives a refresh. When the real
 * backend exists, the service layer is swapped to HTTP calls and this module
 * is deleted — the UI never talks to it directly.
 */

const DB_KEY = 'transitx.db.v1'

interface Database {
  schemaVersion: number
  students: Student[]
  drivers: Driver[]
  groups: Group[]
  trips: Trip[]
  payments: Payment[]
  dispatches: DriverDispatch[]
  historySet: Set<string>
}

let db: Database | null = null

/** Listeners notified whenever the dispatch queue changes (live driver updates). */
type DispatchListener = () => void
const dispatchListeners = new Set<DispatchListener>()

function emptyDb(): Database {
  return {
    schemaVersion: 1,
    students: [],
    drivers: [],
    groups: [],
    trips: [],
    payments: [],
    dispatches: [],
    historySet: new Set<string>(),
  }
}

function loadFromStorage(): Database | null {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Database
    parsed.historySet = new Set<string>(parsed.historySet ?? [])
    parsed.dispatches ??= []
    return parsed
  } catch {
    return null
  }
}

function persist(): void {
  if (!db) return
  try {
    localStorage.setItem(
      DB_KEY,
      JSON.stringify({ ...db, historySet: Array.from(db.historySet) }),
    )
  } catch {
    // Storage unavailable — the in-memory store still works for the session.
  }
}

/** Load the store, seeding realistic data on first launch. */
export function initDb(): Database {
  if (db) return db
  const stored = loadFromStorage()
  if (stored && stored.schemaVersion >= 1) {
    db = stored
    // Keep drivers available even when a stored DB was seeded earlier.
    if (db.drivers.length === 0) db.drivers = MOCK_DRIVERS
    return db
  }

  const fresh = emptyDb()
  fresh.drivers = [...MOCK_DRIVERS]
  fresh.groups = seedGroups()
  fresh.trips = seedTrips()
  db = fresh
  persist()
  return db
}

export function getDb(): Database {
  return initDb()
}

export function getGroups(): Group[] {
  return getDb().groups
}

export function getTrips(): Trip[] {
  return getDb().trips
}

export function getDrivers(): Driver[] {
  return getDb().drivers
}

/** Total occupied seats in a group (a member may hold 4 seats). */
export function groupSeatCount(group: Group): number {
  return group.members.reduce((sum, m) => sum + m.seats, 0)
}

export function groupIsFull(group: Group): boolean {
  return groupSeatCount(group) >= group.maxSize
}

/** Mark a history trip as visited/consumed so we do not re-seed it. */
export function markHistory(id: string): void {
  const current = getDb()
  current.historySet.add(id)
  persist()
}

/* ------------------------------------------------------------------ */
/* Driver dispatch queue (fully-funded / instant-departure rides)      */
/* ------------------------------------------------------------------ */

/** Subscribe to live changes in the driver dispatch queue. Returns an unsubscribe fn. */
export function subscribeDispatches(listener: DispatchListener): () => void {
  dispatchListeners.add(listener)
  return () => {
    dispatchListeners.delete(listener)
  }
}

function notifyDispatchListeners(): void {
  for (const listener of dispatchListeners) listener()
}

export function getDispatches(): DriverDispatch[] {
  return getDb().dispatches
}

export function addDispatch(dispatch: DriverDispatch): void {
  const current = getDb()
  current.dispatches.push(dispatch)
  persist()
  notifyDispatchListeners()
}

export function setDispatchAcknowledged(dispatchId: string, acknowledged: boolean): void {
  const current = getDb()
  const dispatch = current.dispatches.find((d) => d.id === dispatchId)
  if (dispatch) {
    dispatch.acknowledged = acknowledged
    persist()
    notifyDispatchListeners()
  }
}

export function removeDispatch(dispatchId: string): void {
  const current = getDb()
  current.dispatches = current.dispatches.filter((d) => d.id !== dispatchId)
  persist()
  notifyDispatchListeners()
}

/**
 * Retract every live dispatch broadcast for a group (e.g. a passenger left the
 * ride), removing its card from the drivers' queue in real time.
 */
export function retractGroupDispatches(groupId: string): void {
  const current = getDb()
  const next = current.dispatches.filter((d) => d.groupId !== groupId)
  if (next.length !== current.dispatches.length) {
    current.dispatches = next
    persist()
    notifyDispatchListeners()
  }
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

function nextCode(prefix: string, existing: string[]): string {
  let n = existing.length + 1
  let code = `${prefix}${String(n).padStart(3, '0')}`
  while (existing.includes(code)) {
    n += 1
    code = `${prefix}${String(n).padStart(3, '0')}`
  }
  return code
}

export function createGroup(pickup: CampusLocation, destination: CampusLocation, member: GroupMember): Group {
  const current = getDb()
  const codes = current.groups.map((g) => g.code)
  const group: Group = {
    id: crypto.randomUUID(),
    code: nextCode('G', codes),
    pickup,
    destination,
    members: [member],
    maxSize: MAX_GROUP_SIZE,
    status: groupIsFull({ members: [member], maxSize: MAX_GROUP_SIZE } as Group)
      ? 'FULL'
      : 'WAITING',
    createdAt: new Date().toISOString(),
  }
  current.groups.push(group)
  persist()
  return group
}

export function addGroupMember(groupId: string, member: GroupMember): Group {
  const current = getDb()
  const group = current.groups.find((g) => g.id === groupId) ?? current.groups.find((g) => g.code === groupId)
  if (!group) throw new Error('Group not found')
  const occupied = groupSeatCount(group)
  if (occupied + member.seats > group.maxSize) {
    throw new Error('This group does not have enough free seats left')
  }
  if (group.status !== 'WAITING' && group.status !== 'FULL') {
    throw new Error('This group can no longer accept passengers')
  }
  group.members.push(member)
  if (groupIsFull(group) && group.status === 'WAITING') {
    group.status = 'FULL'
  }
  persist()
  return group
}

export function setGroupStatus(groupId: string, status: Group['status']): Group {
  const current = getDb()
  const group = current.groups.find((g) => g.id === groupId)
  if (group) {
    group.status = status
    persist()
    return group
  }
  throw new Error('Group not found')
}

/**
 * Pay for the remaining `additionalSeats` in a group so it fills instantly.
 * The buyer's existing member record is credited (a new one when absent).
 * The group is forced to FULL — ready for immediate dispatch.
 */
export function buyOutRemainingSeats(groupId: string, additionalSeats: number, member: GroupMember): Group {
  const current = getDb()
  const group = current.groups.find((g) => g.id === groupId) ?? current.groups.find((g) => g.code === groupId)
  if (!group) throw new Error('Group not found')
  if (group.status !== 'WAITING') throw new Error('This group is no longer waiting for seats.')
  const occupied = groupSeatCount(group)
  const remaining = group.maxSize - occupied
  if (additionalSeats > remaining) throw new Error('This group does not have enough free seats left')
  const existingMember = group.members.find((m) => m.isCurrentUser)
  if (existingMember) {
    existingMember.seats += additionalSeats
  } else {
    group.members.push({ ...member, seats: additionalSeats })
  }
  group.fullyFunded = true
  group.status = 'FULL'
  persist()
  return group
}

export function removeGroup(groupId: string): void {
  const current = getDb()
  current.groups = current.groups.filter((g) => g.id !== groupId)
  persist()
}

/**
 * Remove the signed-in student's membership slot from a group.
 *
 * When the group has already been broadcast to drivers (a fully-funded
 * dispatch queued, or a driver assigned but not yet accepted), the broadcast is
 * retracted so the request card leaves the driver queue. Once a driver has
 * ACCEPTED the ride, leaving is rejected (accepted trips cannot be cancelled).
 * The group persists for the remaining passengers and reopens to WAITING when
 * seats free up. Returns null if the group is now empty (it is removed).
 */
export function leaveGroup(groupId: string): Group | null {
  const current = getDb()
  const group = current.groups.find((g) => g.id === groupId) ?? current.groups.find((g) => g.code === groupId)
  if (!group) throw new Error('Group not found')
  const index = group.members.findIndex((m) => m.isCurrentUser)
  if (index === -1) throw new Error('You are not a member of this group.')

  // Guard: if the driver has already accepted, the ride is committed.
  const trip = group.tripId ? current.trips.find((t) => t.id === group.tripId) : undefined
  if (isGroupAccepted(group.status) || (trip ? isTripAccepted(trip.status) : false)) {
    throw new Error('A driver is already assigned to this trip. You cannot leave the group now.')
  }

  // Retract any broadcast: pull live dispatches and any not-yet-accepted trip
  // assignment off the driver side so the request cards disappear.
  retractGroupDispatches(group.id)
  if (group.tripId) {
    current.trips = current.trips.filter((t) => t.id !== group.tripId)
  }

  // Free the seat(s) this member held (e.g. 3/4 -> 2/4).
  group.members.splice(index, 1)

  const occupied = groupSeatCount(group)
  if (occupied === 0) {
    current.groups = current.groups.filter((g) => g.id !== group.id)
    persist()
    return null
  }

  // A member backed out, so reopen the group for more passengers.
  if (group.status === 'FULL' || group.status === 'SEARCHING_DRIVER' || group.status === 'DRIVER_ASSIGNED') {
    group.status = 'WAITING'
  }
  group.fullyFunded = false
  delete group.tripId
  persist()
  return group
}

export function createTrip(
  group: Group,
  driver: Driver,
  status: Trip['status'],
): Trip {
  const current = getDb()
  const codes = current.trips.map((t) => t.code)
  const trip: Trip = {
    id: crypto.randomUUID(),
    code: nextCode('T', codes),
    groupId: group.id,
    pickup: group.pickup,
    destination: group.destination,
    status,
    driverId: driver.id,
    driver,
    requestedAt: new Date().toISOString(),
    fare: group.maxSize,
  }
  current.trips.push(trip)
  group.tripId = trip.id
  persist()
  return trip
}

export function setTripStatus(tripId: string, status: Trip['status']): Trip {
  const current = getDb()
  const trip = current.trips.find((t) => t.id === tripId)
  if (!trip) throw new Error('Trip not found')
  trip.status = status
  if (status === 'IN_PROGRESS' && !trip.startedAt) trip.startedAt = new Date().toISOString()
  if (status === 'COMPLETED' && !trip.completedAt) trip.completedAt = new Date().toISOString()
  persist()
  return trip
}

export function rateTrip(tripId: string, rating: number, comment?: string): Trip {
  const current = getDb()
  const trip = current.trips.find((t) => t.id === tripId)
  if (!trip) throw new Error('Trip not found')
  trip.rating = rating
  trip.comment = comment
  persist()
  return trip
}

export function addPayment(payment: Payment): Payment {
  const current = getDb()
  current.payments.push(payment)
  persist()
  return payment
}

/* ------------------------------------------------------------------ */
/* Users & session                                                     */
/* ------------------------------------------------------------------ */

const SESSION_KEY = 'transitx.session.v1'

export function getStudents(): Student[] {
  return getDb().students
}

export function addStudent(student: Student): Student {
  const current = getDb()
  current.students.push(student)
  persist()
  return student
}

export function findStudent(id: string): Student | undefined {
  return getDb().students.find((s) => s.id === id)
}

export function updateStudent(student: Student): Student {
  const current = getDb()
  current.students = current.students.map((s) => (s.id === student.id ? student : s))
  persist()
  return student
}

export function persistSession(studentId: string): void {
  localStorage.setItem(SESSION_KEY, studentId)
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function readSession(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

/* ------------------------------------------------------------------ */
/* Role                                                                 */
/* ------------------------------------------------------------------ */

const ROLE_KEY = 'transitx.role.v1'

export function persistRole(role: UserRole): void {
  localStorage.setItem(ROLE_KEY, role)
}

export function clearRole(): void {
  localStorage.removeItem(ROLE_KEY)
}

export function readRole(): UserRole | null {
  const value = localStorage.getItem(ROLE_KEY)
  return value === 'student' || value === 'driver' ? value : null
}