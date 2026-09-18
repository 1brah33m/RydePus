import type { CampusLocation, Group, GroupMember } from '../types'
import { delay } from '../utils/delay'
import { isGroupCancellationLocked } from '../utils/rideStatus'
import * as backend from './mockBackend'

/**
 * Group service.
 *
 * Mock implementation. Swap the internals with real HTTP calls later:
 *   GET  /api/v1/groups
 *   POST /api/v1/groups
 *   POST /api/v1/groups/{id}/join
 *   POST /api/v1/groups/{id}/cancel
 *
 * The UI only ever consumes the results of these methods.
 */

export interface CreateGroupInput {
  pickup: CampusLocation
  destination: CampusLocation
  member: GroupMember
}

export class GroupService {
  /** All currently pending groups across campus. */
  async getGroups(): Promise<Group[]> {
    await delay(450)
    return backend.getGroups()
  }

  /** Groups matching an exact pickup + destination route. */
  async getGroupsByRoute(pickupId: string, destinationId: string): Promise<Group[]> {
    await delay(450)
    return backend
      .getGroups()
      .filter((g) => g.pickup.id === pickupId && g.destination.id === destinationId)
  }

  /** Create a new group for the current student. */
  async createGroup(input: CreateGroupInput): Promise<Group> {
    await delay(600)
    return backend.createGroup(input.pickup, input.destination, input.member)
  }

  /** Join an existing group. The backend rejects join attempts on full/closed groups. */
  async joinGroup(groupId: string, member: GroupMember): Promise<Group> {
    await delay(600)
    return backend.addGroupMember(groupId, member)
  }

  /** Cancel the current student's membership / group request. */
  async cancelGroup(groupId: string): Promise<void> {
    await delay(400)
    const group = backend.getGroups().find((g) => g.id === groupId)
    if (group && isGroupCancellationLocked(group.status)) {
      throw new Error(
        'A driver has already accepted your ride. Cancellation is no longer available; please contact support or your driver if necessary.',
      )
    }
    backend.removeGroup(groupId)
  }

  /** Leave a group while keeping it alive for the remaining passengers. */
  async leaveGroup(groupId: string): Promise<Group | null> {
    await delay(400)
    return backend.leaveGroup(groupId)
  }

  /** Fill the remaining seats of a group (buyout) so it departs immediately. */
  async buyOutRemainingSeats(groupId: string, additionalSeats: number, member: GroupMember): Promise<Group> {
    await delay(500)
    return backend.buyOutRemainingSeats(groupId, additionalSeats, member)
  }

  /** Internal: used by the mock "backend" simulation to add passengers over time. */
  async simulatePassengerJoin(groupId: string, member: GroupMember): Promise<Group> {
    await delay(120)
    return backend.addGroupMember(groupId, member)
  }

  /** Internal: advance a group's lifecycle status during simulation. */
  async updateStatus(groupId: string, status: Group['status']): Promise<Group> {
    await delay(60)
    return backend.setGroupStatus(groupId, status)
  }
}

export const groupService = new GroupService()