import { useState } from 'react'
import { Banknote, Building2, Check, CheckCircle2, Copy, Wallet } from 'lucide-react'
import { cn } from '../../utils/cn'
import { formatCurrency } from '../../utils/format'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import type { Driver, Payment, PaymentMethod, Trip } from '../../types'

/**
 * Fare settlement for a ride with an assigned driver.
 *
 * Rydepus has no payment gateway: the student pays by hand — cash to the
 * driver, or a direct transfer to the driver's bank account — then taps
 * "I've paid". That settles the payment on the spot; no driver confirmation is
 * involved.
 */

interface ManualPaymentCardProps {
  trip: Trip
  driver?: Driver | null
  /** This student's payment for the trip, if one was already recorded. */
  payment?: Payment
  /**
   * Seats this student is accountable for on the ride: their own seat plus any
   * empty seats they bought out. Falls back to the server-provided trip
   * allocation, then to the recorded/one-seat default.
   */
  seats?: number
  onPay: (method: PaymentMethod) => Promise<void>
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
}

export function ManualPaymentCard({ trip, driver, payment, seats, onPay }: ManualPaymentCardProps) {
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bank = driver?.bankDetails
  const driverName = driver?.name ?? 'your driver'

  // Seats still owed: zero once a seat commitment has covered them, otherwise
  // the student's own seat. The balance is seats × the per-seat fare.
  // The student always owes for every seat they are accountable for: the flat
  // single-seat fare only applies to a one-seat passenger.
  const seatCount = Math.max(1, seats ?? trip.mySeats ?? payment?.seats ?? 1)
  const totalFare = trip.fare * seatCount

  /* ------------------------- already recorded ------------------------- */
  if (payment) {
    return (
      <Card className="p-5">
        <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Payment</h2>

        {payment.status === 'FAILED' ? (
          <div className="mt-3">
            <Alert tone="error">
              This payment was recorded as not received. Please pay again using the details below.
            </Alert>
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-3 rounded-2xl bg-brand-50 p-4 dark:bg-brand-500/10">
            <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-700 dark:text-brand-300" />
            <div>
              <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
                {formatCurrency(payment.amount)} settled
              </p>
              <p className="mt-0.5 text-sm text-brand-800/80 dark:text-brand-200/80">
                Your {METHOD_LABELS[payment.method].toLowerCase()} payment for {payment.seats} seat
                {payment.seats > 1 ? 's' : ''} is recorded. Thanks for riding with {driverName}.
              </p>
            </div>
          </div>
        )}
      </Card>
    )
  }

  /* ------------------------- record a payment ------------------------- */
  const handlePay = async () => {
    setBusy(true)
    setError(null)
    try {
      await onPay(method)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not record that payment. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const options: { value: PaymentMethod; label: string; hint: string; icon: typeof Banknote }[] = [
    { value: 'CASH', label: 'Cash', hint: 'Pay the driver directly', icon: Banknote },
    { value: 'BANK_TRANSFER', label: 'Direct bank transfer', hint: 'Send from your banking app', icon: Building2 },
  ]

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Pay your fare</h2>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">
            {formatCurrency(totalFare)} · pay {driverName} directly
          </p>
          {seatCount > 1 && (
            <p className="mt-0.5 text-xs text-ink-400 dark:text-slate-500">
              {formatCurrency(trip.fare)} × {seatCount} seats
            </p>
          )}
        </div>
        <Wallet aria-hidden className="size-5 shrink-0 text-ink-300 dark:text-slate-600" />
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">
          Payment option
        </legend>
        <div className="mt-2 flex flex-col gap-2">
          {options.map((option) => {
            const Icon = option.icon
            const disabled = option.value === 'BANK_TRANSFER' && !bank
            return (
              <label
                key={option.value}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
                  disabled
                    ? 'cursor-not-allowed border-ink-100 bg-ink-50 opacity-60 dark:border-white/5 dark:bg-white/5'
                    : 'cursor-pointer border-ink-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500',
                  method === option.value &&
                    !disabled &&
                    'border-brand-500 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-500/10',
                )}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={option.value}
                  checked={method === option.value}
                  disabled={disabled}
                  onChange={() => setMethod(option.value)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl',
                    method === option.value && !disabled
                      ? 'bg-brand-500 text-white'
                      : 'bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-slate-300',
                  )}
                >
                  <Icon aria-hidden className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-900 dark:text-slate-100">{option.label}</span>
                  <span className="block text-xs text-ink-500 dark:text-slate-400">
                    {disabled ? 'Driver has not added bank details yet' : option.hint}
                  </span>
                </span>
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                    method === option.value && !disabled
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-ink-300 dark:border-slate-600',
                  )}
                >
                  {method === option.value && !disabled && <Check aria-hidden className="size-3" />}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {method === 'BANK_TRANSFER' && bank && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            Send {formatCurrency(totalFare)} to
          </p>
          <dl className="mt-2.5 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500 dark:text-slate-400">Bank</dt>
              <dd className="font-semibold text-ink-900 dark:text-slate-100">{bank.bankName}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500 dark:text-slate-400">Account name</dt>
              <dd className="font-semibold text-ink-900 dark:text-slate-100">{bank.accountName}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-500 dark:text-slate-400">Account number</dt>
              <dd className="font-mono text-base font-bold tracking-wider text-ink-900 tabular-nums dark:text-slate-100">
                {bank.accountNumber}
              </dd>
            </div>
          </dl>
          <CopyAccountNumber accountNumber={bank.accountNumber} />
        </div>
      )}

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <Button size="lg" fullWidth className="mt-4" loading={busy} onClick={handlePay}>
        <CheckCircle2 aria-hidden className="size-4" />
        {method === 'CASH' ? "I've paid the driver in cash" : "I've sent the transfer"}
      </Button>
      <p className="mt-2.5 text-center text-xs text-ink-400 dark:text-slate-500">
        Recorded straight away. Only pay once you have the money with {driverName}.
      </p>
    </Card>
  )
}

/** Copy-to-clipboard helper, so the account number can be pasted into a banking app. */
function CopyAccountNumber({ accountNumber }: { accountNumber: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber)
    } catch {
      // Clipboard is unavailable (insecure context or denied): select the text instead.
      const field = document.createElement('textarea')
      field.value = accountNumber
      document.body.appendChild(field)
      field.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(field)
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" fullWidth className="mt-3.5" onClick={() => void handleCopy()}>
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      {copied ? 'Account number copied' : 'Copy Account Number'}
    </Button>
  )
}
