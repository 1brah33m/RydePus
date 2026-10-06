import type { CampusLocation, Group, GroupMember, GroupStatus } from '../types'
import { coordsFor, findLocation } from '../config/locations'
import { CURRENCY, GROUP_SEATS, perSeatFare } from '../config/pricing'
import { apiClient } from './apiClient'

/**
 * Group service — wired to the Django backend.
 *
 *   GET  /api/v1/groups/          -> getGroups()
 *   POST /api/v1/groups/          -> createGroup()
 *   POST /api/v1/groups/{id}/join -> joinGroup()
 *   POST /api/v1/groups/{id}/leave-> leaveGroup()
 *   POST /api/v1/groups/{id}/buyout-> buyOutSeats()
 *   POST /api/v1/groups/{id}/cancel -> cancelGroup()
 *
 * The backend owns membership, capacity and status; the UI never enforces
 * business rules locally.
 */

export interface ApiGroupMember {
  id: number
  name: string
  is_creator: boolean
}

export interface ApiGroup {
  id: number
  name: string
  pickup_location: string
  destination: string
  pickup_lat: string | null
  pickup_lng: string | null
  destination_lat: string | null
  destination_lng: string | null
  capacity: number
  status: 'WAITING' | 'FULL'
  member_count: number
  bought_seats: number
  seats_filled: number
  remaining_seats: number
  /** Server-priced fares; the UI must not recompute these. */
  fare_per_seat: string
  fare_total: string
  created_by: number
  created_by_name: string
  members: ApiGroupMember[]
  my_membership: boolean
  created_at: string
  updated_at: string
}

export interface CreateGroupInput {
  pickup: CampusLocation
  destination: CampusLocation
  /**
   * How many seats this student intends to pay for, including their own. The
   * extra seats are bought out right after the group is created.
   */
  seats?: number
}

export function mapGroup(api: ApiGroup, currentMemberId?: string): Group {
  const members: GroupMember[] = api.members.map((m) => ({
    id: String(m.id),
    name: m.name,
    seats: 1,
    isCurrentUser: currentMemberId !== undefined && String(m.id) === currentMemberId,
  }))

  const status: GroupStatus = api.status === 'FULL' ? 'FULL' : 'WAITING'
  const seatsFilled = Math.min(api.capacity, api.seats_filled ?? members.length)
  const boughtSeats = api.bought_seats ?? 0

  return {
    id: String(api.id),
    code: api.name,
    pickup: findLocation(api.pickup_location),
    destination: findLocation(api.destination),
    members,
    maxSize: api.capacity,
    status,
    createdAt: api.created_at,
    tripId: undefined,
    boughtSeats,
    seatsFilled,
    remainingSeats: api.remaining_seats ?? Math.max(0, api.capacity - seatsFilled),
    // Server-authoritative, so every screen shows the same number.
    farePerSeat: Number(api.fare_per_seat ?? 0),
    fareTotal: Number(api.fare_total ?? 0),
    isDispatchable: members.length + boughtSeats >= api.capacity,
  }
}

export class GroupService {
  /** All currently open groups across campus. */
  async getGroups(currentMemberId?: string): Promise<Group[]> {
    const groups = await apiClient.get<ApiGroup[]>('/groups/', { auth: true })
    return groups.map((g) => mapGroup(g, currentMemberId))
  }

  /**
   * Create a new group; the creator becomes its first member.
   *
   * Coordinates are sent so the backend can price the route itself — without
   * them it would fall back to the flat minimum fare. The chosen seat count and
   * its total (seats x per-seat fare) travel with the request so the backend
   * can create and settle the creator's seats in one step; the server remains
   * the source of truth and may reprice.
   */
  async createGroup(input: CreateGroupInput, currentMemberId?: string): Promise<Group> {
    const pickup = coordsFor(input.pickup.id)
    const destination = coordsFor(input.destination.id)
    const seats = Math.max(1, Math.min(GROUP_SEATS, Math.trunc(input.seats ?? 1)))
    const amount = perSeatFare(input.pickup.id, input.destination.id) * seats

    const api = await apiClient.post<ApiGroup>(
      '/groups/',
      {
        name: `${input.pickup.name} → ${input.destination.name}`,
        pickup_location: input.pickup.name,
        destination: input.destination.name,
        ...(pickup && destination
          ? {
              pickup_lat: pickup.lat,
              pickup_lng: pickup.lng,
              destination_lat: destination.lat,
              destination_lng: destination.lng,
            }
          : {}),
        capacity: GROUP_SEATS,
        seats,
        amount,
        currency: CURRENCY,
      },
      { auth: true },
    )
    return mapGroup(api, currentMemberId)
  }

  /** Join an existing group. The backend rejects full/closed groups. */
  async joinGroup(groupId: string, currentMemberId?: string): Promise<Group> {
    const api = await apiClient.post<ApiGroup>(`/groups/${groupId}/join/`, undefined, { auth: true })
    return mapGroup(api, currentMemberId)
  }

  /**
   * Pay for a number of the group's empty seats.
   *
   * The backend prices the seats from the group's own coordinates and treats
   * the server price as authoritative. `amount` is sent for compatibility with
   * endpoints that validate it up front (it is `seats x per-seat fare`); a
   * server that reprices simply ignores it.
   */
  async buyOutSeats(groupId: string, seats: number, amount?: number): Promise<void> {
    await apiClient.post(
      `/groups/${groupId}/buyout/`,
      { seats, currency: CURRENCY, ...(amount !== undefined ? { amount } : {}) },
      { auth: true },
    )
  }

  /** Leave a group while keeping it alive for the remaining passengers. */
  async leaveGroup(groupId: string): Promise<void> {
    await apiClient.post<void>(`/groups/${groupId}/leave/`, undefined, { auth: true })
  }

  /** Cancel the group (creator only). Pending trips are cancelled too. */
  async cancelGroup(groupId: string): Promise<void> {
    await apiClient.post<void>(`/groups/${groupId}/cancel/`, undefined, { auth: true })
  }
}

export const groupService = new GroupService()