import { cn } from '../../utils/cn'
import type { HTMLAttributes, ReactNode } from 'react'

type Tone = 'amber' | 'teal' | 'blue' | 'violet' | 'green' | 'rose' | 'ink'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  children: ReactNode
  dot?: boolean
}

const toneClasses: Record<Tone, string> = {
  amber: 'bg-keke-100 text-keke-600 border-keke-200 dark:bg-keke-500/15 dark:text-keke-300 dark:border-keke-500/30',
  teal: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30',
  blue: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
  violet: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  ink: 'bg-ink-100 text-ink-600 border-ink-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15',
}

const dots: Record<Tone, string> = {
  amber: 'bg-keke-500',
  teal: 'bg-brand-500',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
  green: 'bg-emerald-500',
  rose: 'bg-rose-500',
  ink: 'bg-ink-400',
}

export function Badge({ tone = 'ink', dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} aria-hidden />}
      {children}
    </span>
  )
}