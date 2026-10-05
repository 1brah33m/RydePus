import type { Group, Trip } from '../types'

export type DispatchDecision =
  | { kind: 'skip' }
  | { kind: 'reuse'; trip: Trip }
  | { kind: 'create' }

/**
 * Decide whether a group needs a ride request sent out to the driver queue.
 *
 * A group that already rode must never be dispatched again. `isDispatchable`
 * counts seats only, so a full group stays dispatchable indefinitely; treating
 * a COMPLETED trip as "no trip exists" makes every refresh create a fresh ride
 * for a ride that has already been taken.
 */
export function decideDispatch(group: Group, knownTrips: Trip[]): DispatchDecision {
  if (!group.isDispatchable) return { kind: 'skip' }

  const groupTrips = knownTrips.filter((t) => t.groupId === group.id)
  if (groupTrips.some((t) => t.status === 'COMPLETED')) return { kind: 'skip' }

  // A cancelled ride does not count: the group still wants to travel.
  const existing = groupTrips.find((t) => t.status !== 'CANCELLED')
  if (existing) return { kind: 'reuse', trip: existing }

  return { kind: 'create' }
}