import { cn } from '../../utils/cn'
import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border border-border bg-card shadow-sm', className)}
      {...rest}
    >
      {children}
    </div>
  )
}