import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Lock } from 'lucide-react'
import { CAMPUS_LOCATIONS, FARE_PER_SEAT } from '../../mock/data'
import { useApp } from '../../context/AppContext'
import { formatCurrency } from '../../utils/format'
import { AppHeader } from '../../components/navigation/AppHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { RouteIndicator } from '../../components/shared/RouteIndicator'

type PayState = 'idle' | 'processing' | 'success' | 'error'

export function PaymentCheckout() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { payForFourSeats } = useApp()

  const pickupId = params.get('pickup') ?? ''
  const destinationId = params.get('destination') ?? ''
  const pickup = CAMPUS_LOCATIONS.find((l) => l.id === pickupId)
  const destination = CAMPUS_LOCATIONS.find((l) => l.id === destinationId)

  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvv: '' })
  const [payState, setPayState] = useState<PayState>('idle')
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up any pending navigation timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!pickup || !destination) {
    return <Navigate to="/home" replace />
  }

  const total = FARE_PER_SEAT * 4

  const handlePay = async (e: FormEvent) => {
    e.preventDefault()
    if (!card.name.trim() || !card.number.trim() || !card.expiry.trim() || !card.cvv.trim()) {
      setError('Please fill in all card details to continue.')
      return
    }
    setPayState('processing')
    setError(null)
    try {
      const { group } = await payForFourSeats(pickup, destination, 'card')
      setPayState('success')
      // Briefly show success, then land on the (FULL) group screen.
      timerRef.current = setTimeout(() => {
        navigate(`/groups/${group.id}`, { replace: true })
      }, 1400)
    } catch (err) {
      setPayState('error')
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'The payment did not go through. No charge was made. Please try again.',
      )
    }
  }

  if (payState === 'success') {
    return (
      <>
        <AppHeader title="Payment" onBack={() => navigate('/home')} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/15">
            <CheckCircle2 aria-hidden className="size-9 text-brand-700 dark:text-brand-300" />
          </span>
          <h2 className="mt-5 text-xl font-bold text-ink-900 dark:text-slate-100">Payment successful</h2>
          <p className="mt-2 text-sm text-ink-500 dark:text-slate-400">
            {formatCurrency(total)} paid for 4 seats ({pickup.name} → {destination.name}).
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
            <span className="size-1.5 animate-pulse rounded-full bg-brand-500" />
            Group FULL — finding driver…
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader title="Checkout" />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-10 pt-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <RouteIndicator pickup={pickup} destination={destination} size="sm" />
            <span className="shrink-0 text-sm font-bold text-ink-800 dark:text-slate-200">{formatCurrency(total)}</span>
          </div>
          <p className="mt-2 text-xs text-ink-400 dark:text-slate-500">4 seats · Pay for the whole keke</p>
        </Card>

        <Card className="p-5">
          <form onSubmit={handlePay} className="space-y-4">
            <Input
              label="Cardholder name"
              placeholder="e.g. QUADRI ADEBAYO"
              autoComplete="cc-name"
              value={card.name}
              onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
            />
            <Input
              label="Card number"
              placeholder="0000 0000 0000 0000"
              inputMode="numeric"
              autoComplete="cc-number"
              maxLength={19}
              value={card.number}
              onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Expiry"
                placeholder="MM/YY"
                inputMode="numeric"
                autoComplete="cc-exp"
                maxLength={5}
                value={card.expiry}
                onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
              />
              <Input
                label="CVV"
                placeholder="•••"
                inputMode="numeric"
                autoComplete="cc-csc"
                type="password"
                maxLength={4}
                value={card.cvv}
                onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value }))}
              />
            </div>

            {payState === 'error' && error && <Alert tone="error">{error}</Alert>}
            {error && payState === 'idle' && <Alert tone="info">{error}</Alert>}

            <Button size="lg" fullWidth loading={payState === 'processing'} type="submit">
              <Lock aria-hidden className="size-4" />
              {payState === 'processing' ? 'Processing payment…' : `Pay ${formatCurrency(total)}`}
            </Button>
          </form>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-400 dark:text-slate-500">
            <Lock aria-hidden className="size-3.5" />
            Secure demo checkout — no card is charged. Use any card details.
          </p>
        </Card>
      </div>
    </>
  )
}