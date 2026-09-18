import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-white/60 px-6 py-12 text-center dark:border-slate-700 dark:bg-white/5">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
        <Icon aria-hidden className="size-7 text-brand-600 dark:text-brand-400" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-800 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}