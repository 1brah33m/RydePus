import type { Driver } from '../types'
import { delay } from '../utils/delay'
import * as backend from './mockBackend'

/**
 * Driver matching service.
 *
 * Mock implementation. Swap the internals with real HTTP calls later:
 *   POST /api/v1/drivers/match
 */
export class DriverService {
  async findDriverForRoute(_pickupId: string, _destinationId: string): Promise<Driver> {
    await delay(250)
    const drivers = backend.getDrivers()
    if (drivers.length === 0) throw new Error('No drivers available.')
    return drivers[Math.floor(Math.random() * drivers.length)]
  }
}

export const driverService = new DriverService()