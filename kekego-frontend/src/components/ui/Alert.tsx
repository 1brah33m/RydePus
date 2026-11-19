import type { ReactNode } from 'react'
import { CheckmarkCircle02Icon, AlertCircleIcon, InformationCircleIcon } from 'hugeicons-react'
import { cn } from '../../utils/cn'

type Tone = 'success' | 'error' | 'info' | 'error-dark'

const styles: Record<Tone, { box: string; icon: string }> = {
  success: {
    box: 'border-border bg-card text-card-foreground',
    icon: 'text-primary',
  },
  error: {
    box: 'border-destructive/30 bg-destructive/10 text-destructive',
    icon: 'text-destructive',
  },
  info: {
    box: 'border-border bg-muted text-muted-foreground',
    icon: 'text-muted-foreground',
  },
  'error-dark': { box: 'border-destructive/30 bg-destructive/10 text-destructive', icon: 'text-destructive' },
}

const icons: Record<Tone, typeof CheckmarkCircle02Icon> = {
  success: CheckmarkCircle02Icon,
  error: AlertCircleIcon,
  'error-dark': AlertCircleIcon,
  info: InformationCircleIcon,
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