import { Banknote, CalendarDays, ChevronRight, CreditCard } from 'lucide-react'
import { DriverShell } from '../../components/navigation/DriverShell'
import { OnlineToggle } from '../../components/driver/OnlineToggle'
import { useDriverRide } from '../../hooks/useDriverRide'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'

const DAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function DriverEarnings() {
  const { profile, online, history, completedTotal, setOnline } = useDriverRide()

  const completed = history.filter((t) => t.status === 'COMPLETED')

  // Bucket completed fares by day-of-week for the current week.
  const buckets = new Array<number>(7).fill(0)
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() - now.getDay())
  for (const trip of completed) {
    const at = trip.completedAt ? new Date(trip.completedAt) : null
    if (at && at >= weekStart) {
      buckets[at.getDay()] += trip.fareTotal ?? trip.fare * (trip.passengerCount ?? 1)
    }
  }
  const weekDays = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: DAY_ORDER[d], amount: buckets[d] }))
  const weekTotal = weekDays.reduce((sum, d) => sum + d.amount, 0)
  const weekTrips = completed.filter((t) => {
    const at = t.completedAt ? new Date(t.completedAt) : null
    return Boolean(at && at >= weekStart)
  }).length

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
          <OnlineToggle online={online} onToggle={() => void setOnline(!online)} />
        </header>

        {/* Balance + week chart, side by side on desktop */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="Balance summary">
            <div className="relative overflow-hidden rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              <span aria-hidden className="absolute -right-10 -top-10 size-36 rounded-full bg-brand-500/10 blur-2xl dark:bg-brand-500/15" />
              <div className="relative">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-slate-400">
                  <CreditCard aria-hidden className="size-3.5" />
                  This week
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{formatCurrency(weekTotal)}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">Next payout Friday · Rydepus Wallet</p>
              </div>
            </div>
          </section>

          {/* Week chart */}
          <section aria-label="Weekly earnings">
            <div className="rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">This week</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
                  <CalendarDays aria-hidden className="size-3.5" />
                  {weekTrips} trip{weekTrips === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-5 flex h-32 items-end justify-between gap-2">
                {weekDays.map((d) => {
                  const max = Math.max(...weekDays.map((x) => x.amount), 1)
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
              title="Completed rides"
              subtitle={`${completed.length} lifetime trip${completed.length === 1 ? '' : 's'}`}
              value={formatCurrency(completedTotal)}
            />
            <BreakdownRow
              icon={CalendarDays}
              title="This week"
              subtitle={`${weekTrips} trip${weekTrips === 1 ? '' : 's'} this week`}
              value={formatCurrency(weekTotal)}
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
            {profile?.vehicle_plate || 'No plate set'} · {history.length} lifetime trips
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