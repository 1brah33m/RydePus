import type { Group, Trip } from '../types'
import { delay } from '../utils/delay'
import { isTripCancellationLocked } from '../utils/rideStatus'
import * as backend from './mockBackend'
import { driverService } from './driverService'

/**
 * Trip service.
 *
 * Mock implementation. Swap the internals with real HTTP calls later:
 *   GET  /api/v1/trips
 *   GET  /api/v1/trips/{id}
 *   POST /api/v1/trips/{id}/cancel
 *
 * The UI never talks to endpoints directly.
 */

export class TripService {
  async getTrips(): Promise<Trip[]> {
    await delay(450)
    return backend.getTrips()
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    await delay(300)
    return backend.getTrips().find((t) => t.id === id) ?? backend.getTrips().find((t) => t.code === id)
  }

  /** Assign a driver to a full group and create the trip record. */
  async assignDriver(group: Group): Promise<Trip> {
    const driver = await driverService.findDriverForRoute(group.pickup.id, group.destination.id)
    return backend.createTrip(group, driver, 'DRIVER_ASSIGNED')
  }

  /** Internal: advance a trip status during simulation. */
  async updateStatus(tripId: string, status: Trip['status']): Promise<Trip> {
    await delay(60)
    return backend.setTripStatus(tripId, status)
  }

  /** Cancel a trip (only allowed before a driver is matched). */
  async cancelTrip(tripId: string): Promise<Trip> {
    await delay(500)
    const existing =
      backend.getTrips().find((t) => t.id === tripId) ?? backend.getTrips().find((t) => t.code === tripId)
    if (!existing) throw new Error('We could not find this trip.')
    if (isTripCancellationLocked(existing.status)) {
      throw new Error(
        'A driver has already accepted your ride. Cancellation is no longer available; please contact support or your driver if necessary.',
      )
    }
    const trip = backend.setTripStatus(existing.id, 'CANCELLED')
    const group = backend.getGroups().find((g) => g.id === trip.groupId)
    if (group) backend.removeGroup(group.id)
    return trip
  }

  /** Submit a ride rating. */
  async submitRating(tripId: string, rating: number, comment?: string): Promise<Trip> {
    await delay(500)
    return backend.rateTrip(tripId, rating, comment)
  }
}

export const tripService = new TripService()