import type { CampusLocation, Group, GroupMember, GroupStatus } from '../types'
import { findLocation } from '../config/locations'
import { CURRENCY, GROUP_SEATS } from '../config/pricing'
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
  capacity: number
  status: 'WAITING' | 'FULL'
  member_count: number
  bought_seats: number
  seats_filled: number
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
    boughtSeats: api.bought_seats ?? 0,
    seatsFilled,
    isDispatchable: members.length + (api.bought_seats ?? 0) >= api.capacity,
  }
}

export class GroupService {
  /** All currently open groups across campus. */
  async getGroups(currentMemberId?: string): Promise<Group[]> {
    const groups = await apiClient.get<ApiGroup[]>('/groups/', { auth: true })
    return groups.map((g) => mapGroup(g, currentMemberId))
  }

  /** Create a new group; the creator becomes its first member. */
  async createGroup(input: CreateGroupInput, currentMemberId?: string): Promise<Group> {
    const api = await apiClient.post<ApiGroup>(
      '/groups/',
      {
        name: `${input.pickup.name} → ${input.destination.name}`,
        pickup_location: input.pickup.name,
        destination: input.destination.name,
        capacity: GROUP_SEATS,
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
   * Pay for every remaining seat so the group can leave straight away.
   * The backend requires the exact number of remaining seats.
   */
  async buyOutSeats(groupId: string, seats: number, amount: number): Promise<void> {
    await apiClient.post(`/groups/${groupId}/buyout/`, { seats, amount, currency: CURRENCY }, { auth: true })
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