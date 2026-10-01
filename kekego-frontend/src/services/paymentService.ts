import type { Payment, PaymentMethod, PaymentStatus } from '../types'
import { CURRENCY } from '../config/pricing'
import { apiClient } from './apiClient'

/**
 * Payment service — wired to the Django backend.
 *
 *   GET  /api/v1/payments/                 -> getPayments()          (student's own)
 *   POST /api/v1/payments/                 -> recordPayment()        (cash or transfer)
 *   GET  /api/v1/payments/collectable/     -> getCollectablePayments (driver)
 *   POST /api/v1/payments/{id}/confirm/    -> confirmPayment()       (driver)
 *   POST /api/v1/payments/{id}/reject/     -> rejectPayment()        (driver)
 *
 * There is no payment gateway: a student pays the driver by cash or direct
 * transfer, and the driver confirms receipt manually.
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
    awaitingConfirmation: api.awaiting_confirmation,
    confirmedAt: api.confirmed_at ?? undefined,
    createdAt: api.created_at,
  }
}

export interface ProcessPaymentInput {
  tripId: string
  amount: number
  method: PaymentMethod
  currency?: string
}

export class PaymentService {
  /** The signed-in student's payment records. */
  async getPayments(): Promise<Payment[]> {
    const payments = await apiClient.get<ApiPayment[]>('/payments/', { auth: true })
    return payments.map(mapPayment)
  }

  /**
   * Record a fare payment made by hand. It stays PENDING until the assigned
   * driver confirms they received the cash or the transfer.
   */
  async processPayment(input: ProcessPaymentInput): Promise<Payment> {
    const api = await apiClient.post<ApiPayment>(
      '/payments/',
      {
        trip: Number(input.tripId),
        amount: input.amount,
        method: input.method,
        currency: input.currency ?? CURRENCY,
      },
      { auth: true },
    )
    return mapPayment(api)
  }

  /** Driver: fares claimed by students on this driver's rides. */
  async getCollectablePayments(): Promise<Payment[]> {
    const payments = await apiClient.get<ApiPayment[]>('/payments/collectable/', { auth: true })
    return payments.map(mapPayment)
  }

  /** Driver: confirms the cash/transfer was received. */
  async confirmPayment(paymentId: string): Promise<Payment> {
    const api = await apiClient.post<ApiPayment>(`/payments/${paymentId}/confirm/`, undefined, { auth: true })
    return mapPayment(api)
  }

  /** Driver: reports that the money never arrived. */
  async rejectPayment(paymentId: string): Promise<Payment> {
    const api = await apiClient.post<ApiPayment>(`/payments/${paymentId}/reject/`, undefined, { auth: true })
    return mapPayment(api)
  }
}

export const paymentService = new PaymentService()