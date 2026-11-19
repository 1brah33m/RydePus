import { cn } from '../../utils/cn'
import type { HTMLAttributes, ReactNode } from 'react'

type Tone = 'amber' | 'teal' | 'blue' | 'violet' | 'green' | 'rose' | 'ink'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  children: ReactNode
  dot?: boolean
}

const toneClasses: Record<Tone, string> = {
  amber: 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  teal: 'border-teal-500/30 bg-teal-500/15 text-teal-700 dark:text-teal-300',
  blue: 'border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300',
  violet: 'border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300',
  green: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  rose: 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300',
  ink: 'border-border bg-muted text-muted-foreground',
}

const dots: Record<Tone, string> = {
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
  green: 'bg-emerald-500',
  rose: 'bg-rose-500',
  ink: 'bg-muted-foreground',
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