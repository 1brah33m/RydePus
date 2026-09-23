import { useMemo } from 'react'
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { formatCurrency, formatDayTime } from '../../utils/format'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { Payment } from '../../types'

export function WalletPage() {
  const { state } = useApp()

  const { balance, activity } = useMemo(() => {
    const payments = state.payments ?? []
    const succeeded = payments.filter((p) => p.status === 'SUCCESS')
    const total = succeeded.reduce((sum, p) => sum + p.amount, 0)
    const sorted = [...payments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    return { balance: total, activity: sorted }
  }, [state.payments])

  return (
    <div className="flex min-h-full flex-col gap-5 pb-8 pt-10 lg:pt-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-slate-100">Wallet</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">Your Rydepus balance and payment activity.</p>
      </header>

      {/* Balance card */}
      <section aria-label="Wallet balance">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-400 p-6 text-white shadow-lg shadow-brand-600/25">
          <div className="absolute -right-10 -top-10 size-36 rounded-full bg-white/15 blur-2xl" aria-hidden />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-100">Available balance</p>
              <p className="mt-2 text-4xl font-bold tracking-tight">{formatCurrency(balance)}</p>
              <p className="mt-1.5 text-sm text-brand-100">Spends on shared keke rides</p>
            </div>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <WalletIcon aria-hidden className="size-6" />
            </span>
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section aria-label="Recent activity">
        <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Recent activity</h2>

        {activity.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3">
            {activity.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </div>
        ) : (
          <Card className="mt-3 p-6">
            <div className="flex flex-col items-center text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
                <Receipt aria-hidden className="size-6 text-brand-600 dark:text-brand-400" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-ink-800 dark:text-slate-200">No transactions yet</h3>
              <p className="mt-1 max-w-xs text-sm text-ink-500 dark:text-slate-400">
                Payments you make for shared rides will appear here.
              </p>
            </div>
          </Card>
        )}
      </section>
    </div>
  )
}

function PaymentRow({ payment }: { payment: Payment }) {
  const success = payment.status === 'SUCCESS'
  const failed = payment.status === 'FAILED'

  return (
    <Card className="flex items-center gap-3 p-4">
      <span
        className={
          success
            ? 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400'
            : 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-slate-400'
        }
      >
        {success ? (
          <ArrowUpRight aria-hidden className="size-5" />
        ) : (
          <ArrowDownLeft aria-hidden className="size-5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900 dark:text-slate-100">
          {payment.groupId ? 'Keke ride payment' : 'Wallet top-up'}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-slate-400">
          {payment.method === 'card' ? 'Card' : 'Bank transfer'} · {formatDayTime(payment.createdAt)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={failed ? 'text-sm font-bold text-rose-600 dark:text-rose-300' : 'text-sm font-bold text-ink-900 dark:text-slate-100'}>
          {success ? '−' : ''}
          {formatCurrency(payment.amount)}
        </p>
        <Badge
          tone={success ? 'green' : failed ? 'rose' : 'amber'}
          className="mt-1 capitalize"
        >
          {payment.status.toLowerCase()}
        </Badge>
      </div>
    </Card>
  )
}