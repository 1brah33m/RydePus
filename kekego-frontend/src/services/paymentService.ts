import type { Payment, PaymentMethod, PaymentStatus } from '../types'
import { CURRENCY } from '../config/pricing'
import { apiClient } from './apiClient'

/**
 * Payment service — wired to the Django backend.
 *
 *   GET  /api/v1/payments/                 -> getPayments()          (student's own)
 *   POST /api/v1/payments/                 -> processPayment()       (cash or transfer)
 *   GET  /api/v1/payments/collectable/     -> getCollectablePayments (driver)
 *
 * There is no payment gateway: a student pays the driver by cash or direct
 * transfer, and that declaration settles the payment immediately. There is no
 * driver confirmation step, so no confirm/reject endpoints are called.
 */

export interface ApiPayment {
  id: number
  trip: number | null
  group: number | null
  payer: number
  payer_name: string
  amount: string
  currency: string
  seats: number
  kind: 'TRIP' | 'GROUP_BUYOUT'
  method: 'CASH' | 'BANK_TRANSFER'
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED'
  awaiting_confirmation: boolean
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

function apiStatusToFrontend(api: ApiPayment['status']): PaymentStatus {
  switch (api) {
    case 'SUCCESSFUL':
      return 'SUCCESS'
    case 'FAILED':
      return 'FAILED'
    default:
      return 'PENDING'
  }
}

function mapPayment(api: ApiPayment): Payment {
  return {
    id: String(api.id),
    reference: `REF-${api.id}`,
    tripId: api.trip !== null ? String(api.trip) : undefined,
    groupId: api.group !== null ? String(api.group) : undefined,
    amount: Number(api.amount),
    seats: api.seats,
    currency: api.currency || CURRENCY,
    status: apiStatusToFrontend(api.status),
    method: api.method,
    payerName: api.payer_name,
    confirmedAt: api.confirmed_at ?? undefined,
    createdAt: api.created_at,
  }
}

export interface ProcessPaymentInput {
  tripId: string
  amount: number
  method: PaymentMethod
  currency?: string
  /** Seats this payment covers. The backend checks amount === seats * fare. */
  seats?: number
}

export class PaymentService {
  /** The signed-in student's payment records. */
  async getPayments(): Promise<Payment[]> {
    const payments = await apiClient.get<ApiPayment[]>('/payments/', { auth: true })
    return payments.map(mapPayment)
  }

  /**
   * Record a fare payment made by hand. It settles on creation: there is no
   * provider to reconcile against and no driver to confirm with, so the
   * student's declaration is the record.
   */
  async processPayment(input: ProcessPaymentInput): Promise<Payment> {
    const api = await apiClient.post<ApiPayment>(
      '/payments/',
      {
        trip: Number(input.tripId),
        amount: input.amount,
        method: input.method,
        currency: input.currency ?? CURRENCY,
        seats: input.seats ?? 1,
      },
      { auth: true },
    )
    return mapPayment(api)
  }

  /** Driver: a read-only list of fares collected on this driver's rides. */
  async getCollectablePayments(): Promise<Payment[]> {
    const payments = await apiClient.get<ApiPayment[]>('/payments/collectable/', { auth: true })
    return payments.map(mapPayment)
  }
}

export const paymentService = new PaymentService()