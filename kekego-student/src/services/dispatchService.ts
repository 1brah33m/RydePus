import type { Group, DriverDispatch } from '../types'
import { delay } from '../utils/delay'
import * as backend from './mockBackend'

/**
 * Driver dispatch service.
 *
 * Pushes fully-funded (instant-departure) groups into the driver queue so the
 * dashboard surfaces them as high-priority rides. Drivers acknowledge a
 * dispatch when they act on it so it drops out of the live queue.
 */

export class DispatchService {
  /** Push a paid-up group to the driver queue as an urgent, fully-funded ride. */
  async dispatchFullyFundedGroup(group: Group, fare: number): Promise<DriverDispatch> {
    await delay(300)
    const dispatch: DriverDispatch = {
      id: crypto.randomUUID(),
      kind: 'FULLY_FUNDED',
      groupId: group.id,
      groupCode: group.code,
      pickup: group.pickup,
      destination: group.destination,
      seats: group.maxSize,
      fare,
      createdAt: new Date().toISOString(),
    }
    backend.addDispatch(dispatch)
    return dispatch
  }

  /** Mark a dispatch as handled so it leaves the live queue. */
  async acknowledge(dispatchId: string): Promise<void> {
    await delay(120)
    backend.setDispatchAcknowledged(dispatchId, true)
  }
}

export const dispatchService = new DispatchService()