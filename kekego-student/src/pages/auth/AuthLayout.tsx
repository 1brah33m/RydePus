import type { ReactNode } from 'react'
import { Logo } from '../../components/ui/Logo'
import { cn } from '../../utils/cn'

interface AuthLayoutProps {
  title?: string
  subtitle?: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-full flex-col bg-charcoal px-6 pb-14 pt-10 safe-top">
      <Logo tone="dark" />
      <div className="mx-auto mt-10 w-full max-w-sm">
        {title && <h1 className="text-[26px] font-bold tracking-tight text-white">{title}</h1>}
        {subtitle && <p className="mt-1.5 text-sm text-ink-400">{subtitle}</p>}
        <div className={cn('mt-8', title ? 'mt-7' : undefined)}>{children}</div>
      </div>
    </div>
  )
}