import { cn } from '../../utils/cn'
import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border border-ink-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]', className)}
      {...rest}
    >
      {children}
    </div>
  )
}