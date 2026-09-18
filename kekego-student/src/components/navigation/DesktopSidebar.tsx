import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { CarFront, UserCircle } from 'lucide-react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { cn } from '../../utils/cn'

export interface SidebarItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface DesktopSidebarProps {
  brand: string
  items: SidebarItem[]
  profileTo: string
  profileLabel: string
  footer: string
}

function linkClasses(isActive: boolean) {
  return cn(
    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-500/15 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400'
      : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200',
  )
}

/**
 * Fixed left navigation for desktop (`lg+`). Hidden below the breakpoint,
 * where the fixed bottom tab bar takes over instead. Renders on every
 * student and driver screen via their shell layout.
 */
export function DesktopSidebar({ brand, items, profileTo, profileLabel, footer }: DesktopSidebarProps) {
  return (
    <aside className="sticky top-0 z-30 hidden h-dvh w-64 shrink-0 flex-col border-r border-ink-200/70 bg-white dark:border-slate-800 dark:bg-charcoal lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-ink-200/70 px-6 dark:border-slate-800">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400"
        >
          <CarFront className="size-5" strokeWidth={2.2} />
        </span>
        <span className="text-lg font-extrabold tracking-tight text-ink-900 dark:text-white">{brand}</span>
      </div>

      <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto p-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => linkClasses(isActive)}
          >
            <item.icon aria-hidden className="size-5 shrink-0" strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-ink-200/70 p-4 dark:border-slate-800">
        <NavLink to={profileTo} className={({ isActive }) => linkClasses(isActive)}>
          <UserCircle aria-hidden className="size-5 shrink-0" strokeWidth={2} />
          {profileLabel}
        </NavLink>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-50 px-3.5 py-2.5 dark:bg-white/5">
          <span className="text-sm font-medium text-ink-700 dark:text-slate-200">Dark Mode</span>
          <ThemeToggle />
        </div>
        <p className="mt-4 px-3.5 text-[11px] text-ink-400 dark:text-slate-500">{footer}</p>
      </div>
    </aside>
  )
}