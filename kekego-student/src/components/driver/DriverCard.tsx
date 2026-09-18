import { Phone, Star, Truck } from 'lucide-react'
import type { Driver } from '../../types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

interface DriverCardProps {
  driver: Driver
  onCall?: () => void
  callLoading?: boolean
}

export function DriverCard({ driver, onCall, callLoading = false }: DriverCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3.5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <Truck aria-hidden className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink-900 dark:text-slate-100">{driver.name}</p>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-ink-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Star aria-hidden className="size-3.5 fill-keke-500 text-keke-500" />
              {driver.rating.toFixed(1)}
            </span>
            <span aria-hidden>·</span>
            <span>{driver.totalTrips} trips</span>
          </div>
        </div>
        <Badge tone="teal" className="hidden text-[10px] sm:inline-flex">
          {driver.kekeIdentifier}
        </Badge>
      </div>

      <dl className="mt-3.5 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 text-sm dark:border-white/5">
        <div>
          <dt className="text-xs text-ink-400 dark:text-slate-500">Driver ID</dt>
          <dd className="font-medium text-ink-800 dark:text-slate-200">{driver.kekeIdentifier}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-400 dark:text-slate-500">Plate number</dt>
          <dd className="font-medium text-ink-800 dark:text-slate-200">{driver.plateNumber}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-400 dark:text-slate-500">Phone</dt>
          <dd className="font-medium text-ink-800 dark:text-slate-200">{driver.phone}</dd>
        </div>
      </dl>

      {onCall && (
        <button
          type="button"
          onClick={onCall}
          disabled={callLoading}
          className="mt-3.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-ink-300 bg-white text-sm font-semibold text-ink-800 transition-colors hover:border-brand-500 hover:text-brand-700 disabled:opacity-50 dark:border-slate-700 dark:bg-[#1E1E1E] dark:text-slate-200 dark:hover:border-brand-400 dark:hover:text-brand-300"
        >
          <Phone aria-hidden className="size-4" />
          {callLoading ? 'Calling…' : 'Call Driver'}
        </button>
      )}
    </Card>
  )
}