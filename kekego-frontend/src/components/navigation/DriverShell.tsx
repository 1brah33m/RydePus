import type { ReactNode } from 'react'
import { Home, Inbox, UserCircle, Wallet } from 'lucide-react'
import { DriverBottomNav } from '../driver/DriverBottomNav'
import { DesktopSidebar, type SidebarItem } from './DesktopSidebar'

const ITEMS: SidebarItem[] = [
  { to: '/driver', label: 'Home', icon: Home, end: true },
  { to: '/driver/requests', label: 'Requests', icon: Inbox },
  { to: '/driver/earnings', label: 'Earnings', icon: Wallet },
  { to: '/driver/profile', label: 'Profile', icon: UserCircle },
]

/**
 * Shell for driver dashboard pages: desktop sidebar (lg+) plus a mobile
 * bottom tab bar. Content is centered in `max-w-5xl` with fluid padding.
 */
export function DriverShell({ children }: DriverShellProps) {
  return (
    <div className="flex min-h-full w-full">
      <DesktopSidebar
        brand="Rydepus"
        items={ITEMS}
        profileTo="/driver/profile"
        profileLabel="Driver Profile"
        footer="Rydepus · Campus Shuttle (MVP)"
      />
      <main className="relative min-h-full min-w-0 flex-1 bg-ink-50 pb-24 safe-top text-ink-900 dark:bg-charcoal dark:text-white lg:pb-12">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">{children}</div>
        <DriverBottomNav />
      </main>
    </div>
  )
}

interface DriverShellProps {
  children: ReactNode
}