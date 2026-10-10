import type { CampusLocation, Driver, Trip, TripStatus } from '../types'
import { findLocation } from '../config/locations'
import { apiClient } from './apiClient'

/**
 * Trip service — wired to the Django backend.
 *
 *   GET  /api/v1/trips/                 -> getTrips() (my trips)
 *   POST /api/v1/trips/                 -> createTrip()
 *   POST /api/v1/trips/{id}/cancel/     -> cancelTrip()
 *   POST /api/v1/trips/{id}/rate/       -> submitRating()
 *   GET  /api/v1/trips/available/       -> getAvailableTrips() (drivers)
 *   GET  /api/v1/trips/assigned/        -> getAssignedTrips() (drivers)
 *   GET  /api/v1/trips/history/         -> getDriverHistory() (drivers)
 *   POST /api/v1/trips/{id}/accept/     -> acceptTrip()
 *   POST /api/v1/trips/{id}/start/      -> startTrip()
 *   POST /api/v1/trips/{id}/complete/   -> completeTrip()
 *
 * Statuses are mapped from the backend contract into the frontend domain:
 * PENDING stays pending, ACCEPTED -> DRIVER_ACCEPTED, and the rest pass
 * straight through.
 */

export interface ApiTrip {
  id: number
  group: number | null
  created_by: number
  driver: number | null
  pickup_location: string
  destination: string
  fare: string
  status: 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  passenger_count: number
  fare_total: string
  passengers: { id: number; name: string; seats: number }[]
  my_seats: number | null
  driver_name: string | null
  driver_phone: string | null
  driver_bank: { bank_name: string; account_number: string; account_name: string } | null
  created_by_name: string
  my_rating: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

function apiStatusToFrontend(status: ApiTrip['status']): TripStatus {
  switch (status) {
    case 'ACCEPTED':
      return 'DRIVER_ACCEPTED'
    case 'PENDING':
      return 'PENDING'
    default:
      return status
  }
}

export function mapTrip(api: ApiTrip): Trip {
  const driver: Driver | undefined = api.driver
    ? {
        id: String(api.driver),
        name: api.driver_name ?? 'Driver',
        phone: api.driver_phone ?? '',
        plateNumber: '',
        kekeIdentifier: `#${api.driver}`,
        rating: 0,
        totalTrips: 0,
        bankDetails: api.driver_bank
          ? {
              bankName: api.driver_bank.bank_name,
              accountNumber: api.driver_bank.account_number,
              accountName: api.driver_bank.account_name,
            }
          : undefined,
      }
    : undefined

  return {
    id: String(api.id),
    code: `T${api.id}`,
    groupId: api.group !== null ? String(api.group) : undefined,
    pickup: findLocation(api.pickup_location),
    destination: findLocation(api.destination),
    status: apiStatusToFrontend(api.status),
    driverId: api.driver !== null ? String(api.driver) : undefined,
    driver,
    requestedAt: api.created_at,
    startedAt: api.started_at ?? undefined,
    completedAt: api.completed_at ?? undefined,
    fare: Number(api.fare),
    passengerCount: api.passenger_count,
    // Each member's committed seats (own + bought out); shown identically to
    // the student and the driver so their totals always agree.
    passengers: (api.passengers ?? []).map((p) => ({
      id: String(p.id),
      name: p.name,
      seats: p.seats,
    })),
    mySeats: api.my_seats ?? undefined,
    // Authoritative from the server; older servers that omit it fall back to
    // the per-seat fare times the seats actually filled.
    fareTotal: Number(api.fare_total ?? 0) || Number(api.fare) * (api.passenger_count || 1),
    rating: api.my_rating ?? undefined,
    comment: undefined,
    completedByStudentIds: [],
    driverMarkedComplete: api.status === 'COMPLETED',
  }
}

export interface CreateTripInput {
  groupId: string
  pickup: CampusLocation
  destination: CampusLocation
  fare: number
}

export class TripService {
  /** The signed-in student's trips (created or joined). */
  async getTrips(): Promise<Trip[]> {
    const trips = await apiClient.get<ApiTrip[]>('/trips/', { auth: true })
    return trips.map(mapTrip)
  }

  /** Look up a single trip from the current list. */
  async getTrip(id: string): Promise<Trip | undefined> {
    const trips = await this.getTrips()
    return trips.find((t) => t.id === id) ?? trips.find((t) => t.code === id)
  }

  /** Create a trip for a student's group. The trip waits for a driver. */
  async createTrip(input: CreateTripInput): Promise<Trip> {
    const api = await apiClient.post<ApiTrip>(
      '/trips/',
      {
        group: Number(input.groupId),
        pickup_location: input.pickup.name,
        destination: input.destination.name,
        fare: input.fare,
      },
      { auth: true },
    )
    return mapTrip(api)
  }

  /** Cancel a trip (only allowed while it is still pending). */
  async cancelTrip(tripId: string): Promise<Trip> {
    const api = await apiClient.post<ApiTrip>(`/trips/${tripId}/cancel/`, undefined, { auth: true })
    return mapTrip(api)
  }

  /** Submit a ride rating for a completed trip. */
  async submitRating(tripId: string, rating: number, comment?: string): Promise<void> {
    await apiClient.post(
      `/trips/${tripId}/rate/`,
      { stars: rating, ...(comment ? { comment } : {}) },
      { auth: true },
    )
  }

  /** Driver: pending trips available to accept (online drivers only). */
  async getAvailableTrips(): Promise<Trip[]> {
    const trips = await apiClient.get<ApiTrip[]>('/trips/available/', { auth: true })
    return trips.map(mapTrip)
  }

  /** Driver: trips currently assigned and active. */
  async getAssignedTrips(): Promise<Trip[]> {
    const trips = await apiClient.get<ApiTrip[]>('/trips/assigned/', { auth: true })
    return trips.map(mapTrip)
  }

  /** Driver: completed / cancelled assignment history. */
  async getDriverHistory(): Promise<Trip[]> {
    const trips = await apiClient.get<ApiTrip[]>('/trips/history/', { auth: true })
    return trips.map(mapTrip)
  }

  /** Driver: accept a pending trip. */
  async acceptTrip(tripId: string): Promise<Trip> {
    const api = await apiClient.post<ApiTrip>(`/trips/${tripId}/accept/`, undefined, { auth: true })
    return mapTrip(api)
  }

  /** Driver: mark the assigned trip as started / completed. */
  async updateTripStatus(tripId: string, action: 'start' | 'complete' | 'cancel'): Promise<Trip> {
    const api = await apiClient.post<ApiTrip>(`/trips/${tripId}/${action}/`, undefined, { auth: true })
    return mapTrip(api)
  }
}

export const tripService = new TripService()