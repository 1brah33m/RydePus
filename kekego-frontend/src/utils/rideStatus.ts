import type { Group, Trip } from '../types'

/**
 * Ride-lifecycle locking rules.
 *
 * Once a driver is matched to a ride, the student can no longer cancel it.
 * These helpers are shared by the UI (to hide/disable buttons) and the service
 * layer (to reject cancellation calls as a safeguard).
 */

const LOCKED_TRIP_STATUSES: ReadonlySet<Trip['status']> = new Set([
  'DRIVER_ASSIGNED',
  'DRIVER_ACCEPTED',
  'IN_PROGRESS',
])

const LOCKED_GROUP_STATUSES: ReadonlySet<Group['status']> = new Set([
  'DRIVER_ASSIGNED',
  'DRIVER_ACCEPTED',
  'IN_TRIP',
])

const ACCEPTED_TRIP_STATUSES: ReadonlySet<Trip['status']> = new Set(['DRIVER_ACCEPTED', 'IN_PROGRESS'])

const ACCEPTED_GROUP_STATUSES: ReadonlySet<Group['status']> = new Set(['DRIVER_ACCEPTED', 'IN_TRIP'])

/** True when a driver is assigned/accepted and the trip must not be cancelled. */
export function isTripCancellationLocked(status: Trip['status']): boolean {
  return LOCKED_TRIP_STATUSES.has(status)
}

/** True when a group has been matched to a driver and can no longer be cancelled. */
export function isGroupCancellationLocked(status: Group['status']): boolean {
  return LOCKED_GROUP_STATUSES.has(status)
}

/** True once the driver has accepted the trip (leaving/cancelling is no longer allowed). */
export function isTripAccepted(status: Trip['status']): boolean {
  return ACCEPTED_TRIP_STATUSES.has(status)
}

/** True once the driver has accepted the group's ride (leaving is no longer allowed). */
export function isGroupAccepted(status: Group['status']): boolean {
  return ACCEPTED_GROUP_STATUSES.has(status)
}
