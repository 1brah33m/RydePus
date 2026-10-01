import { useState } from 'react'
import { Banknote, Building2, CheckCircle2, XCircle } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import { formatCurrency } from '../../utils/format'
import type { Payment } from '../../types'

/**
 * Fares students say they have paid, awaiting the driver's confirmation.
 *
 * Cash and direct transfers bypass any gateway, so the driver is the source
 * of truth: confirm that the money arrived, or mark it as not received.
 */

interface PaymentsToConfirmCardProps {
  payments: Payment[]
  onConfirm: (paymentId: string) => Promise<void>
  onReject: (paymentId: string) => Promise<void>
}

export function PaymentsToConfirmCard({ payments, onConfirm, onReject }: PaymentsToConfirmCardProps) {
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (payments.length === 0) return null

  const run = async (id: string, action: (id: string) => Promise<void>) => {
    setWorkingId(id)
    setError(null)
    try {
      await action(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight">Payments to confirm</h2>
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {payments.length} waiting
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">
        Students have marked these fares as paid. Confirm once the cash or transfer is in your account.
      </p>

      {error && <Alert tone="error" className="mt-3">{error}</Alert>}

      <ul className="mt-4 flex flex-col gap-3">
        {payments.map((payment) => {
          const isTransfer = payment.method === 'BANK_TRANSFER'
          const Icon = isTransfer ? Building2 : Banknote
          const busy = workingId === payment.id
          return (
            <li
              key={payment.id}
              className="rounded-2xl border border-ink-200 p-4 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-slate-300">
                  <Icon aria-hidden className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900 dark:text-slate-100">
                    {payment.payerName ?? 'A passenger'}
                  </p>
                  <p className="text-xs text-ink-500 dark:text-slate-400">
                    {isTransfer ? 'Direct bank transfer' : 'Cash on board'}
                  </p>
                </div>
                <p className="shrink-0 text-base font-bold text-ink-900 tabular-nums dark:text-slate-100">
                  {formatCurrency(payment.amount)}
                </p>
              </div>

              <div className="mt-3 flex gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  disabled={busy}
                  onClick={() => void run(payment.id, onReject)}
                >
                  <XCircle aria-hidden className="size-4" />
                  Not received
                </Button>
                <Button
                  size="sm"
                  fullWidth
                  loading={busy}
                  onClick={() => void run(payment.id, onConfirm)}
                >
                  <CheckCircle2 aria-hidden className="size-4" />
                  Confirm received
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
