import { Sparkles, Wallet } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { AppHeader } from '../../components/navigation/AppHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

/**
 * Wallet — placeholder.
 *
 * Rydepus has no in-app balance: fares are settled by hand with the driver
 * (cash or direct bank transfer), so there is nothing to top up or store here
 * yet. When an in-app wallet ships, it will live on this route.
 */
export function WalletPage() {
  const { state } = useApp()

  return (
    <>
      <AppHeader title="Wallet" />
      <div className="flex flex-col gap-5 pb-10 pt-3">
        <Card className="p-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
            <Wallet aria-hidden className="size-7 text-brand-700 dark:text-brand-300" />
          </span>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Sparkles aria-hidden className="size-3.5" />
            Coming soon
          </span>
          <h2 className="mt-3 text-xl font-bold text-ink-900 dark:text-slate-100">Wallet is not live yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500 dark:text-slate-400">
            For now, pay your driver directly — cash, or a straight transfer to their account from your trip page.
            Your driver confirms the payment, and every ride you settle shows up in your trip history.
          </p>
          <Button className="mt-5" to="/trips">
            View My Trips
          </Button>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">
            How you pay today
          </p>
          <ul className="mt-3 space-y-3 text-sm text-ink-600 dark:text-slate-400">
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
              Open the trip once a driver is assigned.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
              Hand over cash, or copy the driver's account number and transfer directly.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
              Tap “I’ve paid” — the driver confirms once they have your money.
            </li>
          </ul>
        </Card>

        {state.payments.length > 0 && (
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">
              Payments settled
            </p>
            <p className="mt-2 text-sm text-ink-500 dark:text-slate-400">
              You have {state.payments.length} recorded payment{state.payments.length === 1 ? '' : 's'} in your trip
              history. Funds move between you and your driver directly, so there is no Rydepus balance to show.
            </p>
          </Card>
        )}
      </div>
    </>
  )
}
