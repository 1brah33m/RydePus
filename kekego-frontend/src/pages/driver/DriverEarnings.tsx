import { useState } from 'react'
import { Banknote, CalendarDays, ChevronRight, CreditCard, TrendingUp } from 'lucide-react'
import { DriverShell } from '../../components/navigation/DriverShell'
import { OnlineToggle } from '../../components/driver/OnlineToggle'
import { MOCK_DRIVERS } from '../../mock/data'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'

const DRIVER = MOCK_DRIVERS[2]

const WEEK_DAYS = [
  { day: 'Mon', amount: 2400 },
  { day: 'Tue', amount: 3100 },
  { day: 'Wed', amount: 1850 },
  { day: 'Thu', amount: 3950 },
  { day: 'Fri', amount: 3200 },
  { day: 'Sat', amount: 0 },
  { day: 'Sun', amount: 0 },
]

const WEEK_TOTAL = WEEK_DAYS.reduce((sum, d) => sum + d.amount, 0)

export function DriverEarnings() {
  const [online, setOnline] = useState(true)

  return (
    <DriverShell>
      <div className="flex min-h-full flex-col gap-6 pb-28 pt-10 lg:pb-10 lg:pt-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-slate-400">Payouts</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight">Earnings</h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">Track your trips and payouts</p>
          </div>
          <OnlineToggle online={online} onToggle={() => setOnline((o) => !o)} />
        </header>

        {/* Balance + week chart, side by side on desktop */}
        <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Balance summary">
          <div className="relative overflow-hidden rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <span aria-hidden className="absolute -right-10 -top-10 size-36 rounded-full bg-brand-500/10 blur-2xl dark:bg-brand-500/15" />
            <div className="relative">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-slate-400">
                <CreditCard aria-hidden className="size-3.5" />
                Available balance
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{formatCurrency(WEEK_TOTAL)}</p>
              <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">Next payout Friday · Rydepus Wallet</p>
            </div>
          </div>
        </section>

        {/* Week chart */}
        <section aria-label="This week">
          <div className="rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">This week</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                <TrendingUp aria-hidden className="size-3.5" />
                +18%
              </span>
            </div>
            <div className="mt-5 flex h-32 items-end justify-between gap-2">
              {WEEK_DAYS.map((d) => {
                const max = Math.max(...WEEK_DAYS.map((x) => x.amount), 1)
                const height = d.amount === 0 ? 6 : Math.max(16, Math.round((d.amount / max) * 100))
                return (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-[10px] font-semibold text-ink-500 dark:text-slate-400">{formatCurrency(d.amount)}</span>
                    <span
                      aria-hidden
                      className={cn(
                        'w-full rounded-t-lg',
                        d.amount === 0 ? 'bg-ink-100 dark:bg-white/10' : 'bg-gradient-to-t from-brand-600 to-brand-400',
                      )}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[11px] font-medium text-ink-400 dark:text-slate-500">{d.day}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
        </div>

        {/* Breakdown rows */}
        <section aria-label="Earnings breakdown">
          <div className="divide-y divide-ink-100 overflow-hidden rounded-3xl border border-ink-200/70 bg-white shadow-sm dark:divide-white/5 dark:border-slate-800 dark:bg-[#1E1E1E]">
            <BreakdownRow
              icon={Banknote}
              title="Tips"
              subtitle="123 total trips this month"
              value={formatCurrency(4850)}
            />
            <BreakdownRow
              icon={CalendarDays}
              title="Cash payout"
              subtitle="Withdraw anytime to your bank"
              value={formatCurrency(WEEK_TOTAL)}
            />
          </div>
          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
          >
            Withdraw Earnings
            <ChevronRight aria-hidden className="size-5" />
          </button>
          <p className="mt-3 text-center text-[11px] text-ink-500 dark:text-slate-500">
            {DRIVER.plateNumber} · 4.9★ · {DRIVER.totalTrips} lifetime trips
          </p>
        </section>

        <p className="pb-2 text-center text-xs text-ink-400 dark:text-slate-500">Rydepus · Campus Shuttle (MVP)</p>
      </div>
    </DriverShell>
  )
}

function BreakdownRow({
  icon: Icon,
  title,
  subtitle,
  value,
}: {
  icon: typeof Banknote
  title: string
  subtitle: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <p className="shrink-0 text-sm font-bold">{value}</p>
    </div>
  )
}