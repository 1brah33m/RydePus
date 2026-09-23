import type { ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '../../utils/cn'

type Tone = 'success' | 'error' | 'info' | 'error-dark'

const styles: Record<Tone, { box: string; icon: string }> = {
  success: {
    box: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-500/10 dark:text-brand-300',
    icon: 'text-brand-600 dark:text-brand-400',
  },
  error: {
    box: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  info: {
    box: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300',
    icon: 'text-sky-600 dark:text-sky-400',
  },
  'error-dark': { box: 'border-rose-400/30 bg-rose-500/10 text-rose-300', icon: 'text-rose-400' },
}

const icons: Record<Tone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  'error-dark': AlertCircle,
  info: Info,
}

export function Alert({ tone = 'info', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  const Icon = icons[tone]
  const style = styles[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', style.box, className)}>
      <Icon aria-hidden className={cn('mt-0.5 size-4.5 shrink-0', style.icon)} />
      <div>{children}</div>
    </div>
  )
}