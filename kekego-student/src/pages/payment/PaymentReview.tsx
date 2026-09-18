import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CreditCard, RotateCcw } from 'lucide-react'
import { CAMPUS_LOCATIONS, FARE_PER_SEAT } from '../../mock/data'
import { formatCurrency } from '../../utils/format'
import { AppHeader } from '../../components/navigation/AppHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { RouteIndicator } from '../../components/shared/RouteIndicator'

export function PaymentReview() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const pickupId = params.get('pickup') ?? ''
  const destinationId = params.get('destination') ?? ''
  const pickup = CAMPUS_LOCATIONS.find((l) => l.id === pickupId)
  const destination = CAMPUS_LOCATIONS.find((l) => l.id === destinationId)

  if (!pickup || !destination) {
    return <Navigate to="/home" replace />
  }

  const checkoutLink = `/payment/checkout?pickup=${encodeURIComponent(pickup.id)}&destination=${encodeURIComponent(destination.id)}`

  return (
    <>
      <AppHeader title="Payment" />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-10 pt-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Route</p>
          <RouteIndicator pickup={pickup} destination={destination} className="mt-1.5" />
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Booking 4 seats</h2>
          <ul className="mt-3 divide-y divide-ink-100 dark:divide-white/5 text-sm">
            <li className="flex items-center justify-between py-2.5">
              <span className="text-ink-600 dark:text-slate-400">Seats (4 × {formatCurrency(FARE_PER_SEAT)})</span>
              <span className="font-semibold text-ink-800 dark:text-slate-200">{formatCurrency(FARE_PER_SEAT * 4)}</span>
            </li>
            <li className="flex items-center justify-between py-2.5">
              <span className="text-ink-600 dark:text-slate-400">Service fee</span>
              <span className="font-semibold text-ink-800 dark:text-slate-200">{formatCurrency(0)}</span>
            </li>
            <li className="flex items-center justify-between py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Why 4 seats?</span>
              <span className="text-xs text-ink-500 dark:text-slate-400">
                <RotateCcw aria-hidden className="mb-0.5 mr-1 inline size-3" />
                No waiting
              </span>
            </li>
            <li className="flex items-center justify-between border-t border-ink-200 dark:border-slate-800 pt-3">
              <span className="font-bold text-ink-900 dark:text-slate-100">Total</span>
              <span className="text-lg font-bold text-brand-700 dark:text-brand-300">{formatCurrency(FARE_PER_SEAT * 4)}</span>
            </li>
          </ul>

          <Button
            size="lg"
            fullWidth
            className="mt-5"
            onClick={() => navigate(checkoutLink)}
          >
            <CreditCard aria-hidden className="size-4" />
            Continue to Payment
          </Button>
          <p className="mt-3 text-center text-xs text-ink-400 dark:text-slate-500">
            Demo checkout only — no real payment is processed.
          </p>
        </Card>
      </div>
    </>
  )
}