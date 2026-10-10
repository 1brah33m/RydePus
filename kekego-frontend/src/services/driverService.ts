import { apiClient } from './apiClient'

/**
 * Driver service — wired to the Django backend.
 *
 *   GET   /api/v1/drivers/me/           -> getProfile()
 *   PATCH /api/v1/drivers/availability/ -> updateAvailability()
 *   PATCH /api/v1/drivers/payout/       -> updatePayoutDetails()
 *
 * Driver "identity" is the signed-in user's DriverProfile; there is no fixed
 * demo driver anymore.
 */

export interface DriverProfile {
  id: number
  email: string
  full_name: string
  phone_number: string
  role: string
  availability_status: 'OFFLINE' | 'ONLINE' | 'BUSY'
  vehicle_type: string
  vehicle_plate: string
  license_number: string
  /** Bank account students transfer fares to. */
  bank_name: string
  account_number: string
  account_name: string
  has_payout_details: boolean
  /** Average star rating across rated trips; null until the driver is rated. */
  rating: number | null
  /** Number of rated trips behind the average. */
  rating_count: number
  created_at: string
  updated_at: string
}

export interface AvailabilityPatch {
  availability_status?: 'OFFLINE' | 'ONLINE'
  vehicle_type?: string
  vehicle_plate?: string
  license_number?: string
}

export interface PayoutDetails {
  bank_name: string
  account_number: string
  account_name: string
}

export class DriverService {
  /** The signed-in driver's profile. */
  async getProfile(): Promise<DriverProfile> {
    return apiClient.get<DriverProfile>('/drivers/me/', { auth: true })
  }

  /** Update availability state and vehicle details. */
  async updateAvailability(patch: AvailabilityPatch): Promise<DriverProfile> {
    return apiClient.patch<DriverProfile>('/drivers/availability/', patch, { auth: true })
  }

  /** Save the bank account that ride fares are transferred to. */
  async updatePayoutDetails(details: PayoutDetails): Promise<DriverProfile> {
    return apiClient.patch<DriverProfile>('/drivers/payout/', details, { auth: true })
  }
}

export const driverService = new DriverService()