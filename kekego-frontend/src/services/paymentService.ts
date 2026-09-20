import type { Payment, PaymentRequest, PaymentResult } from '../types'
import { CURRENCY } from '../mock/data'
import { delay } from '../utils/delay'
import * as backend from './mockBackend'

/**
 * Payment service.
 *
 * Mock implementation — no real money is processed. Swap the internals with a
 * real provider later (e.g. Paystack/Flutterwave via POST /api/v1/payments).
 * The UI only consumes PaymentResult.
 */

export class PaymentService {
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    await delay(1400)

    // Simulate a provider response that can occasionally fail.
    const succeeded = Math.random() > 0.05

    const payment: Payment = {
      id: crypto.randomUUID(),
      reference: `REF-${Date.now().toString(36).toUpperCase()}`,
      amount: request.amount,
      seats: request.seats,
      currency: request.currency,
      status: succeeded ? 'SUCCESS' : 'FAILED',
      method: request.method,
      createdAt: new Date().toISOString(),
    }

    if (succeeded) {
      backend.addPayment(payment)
    }

    return {
      payment,
      reference: payment.reference,
      status: succeeded ? 'SUCCESS' : 'FAILED',
    }
  }
}

export const paymentService = new PaymentService()

export { CURRENCY }