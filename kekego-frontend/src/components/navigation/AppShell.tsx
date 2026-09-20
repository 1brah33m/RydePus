import type { ReactNode } from 'react'
import { Home, Map, Users, Wallet } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { DesktopSidebar, type SidebarItem } from './DesktopSidebar'

const ITEMS: SidebarItem[] = [
  { to: '/home', label: 'Home', icon: Home, end: true },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/trips', label: 'Trips', icon: Map },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
]

/**
 * Application shell for student pages: desktop sidebar (lg+) plus a mobile
 * bottom tab bar. Content stays centered in a readable `max-w-5xl` column
 * with fluid padding on every screen size.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-full w-full">
      <DesktopSidebar
        brand="KekeGo"
        items={ITEMS}
        profileTo="/profile"
        profileLabel="Profile"
        footer="KekeGo · Campus Shuttle (MVP)"
      />
      <main className="relative min-h-full min-w-0 flex-1 bg-ink-50 pb-24 safe-top dark:bg-charcoal lg:pb-12">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">{children}</div>
        <BottomNav />
      </main>
    </div>
  )
}

interface AppShellProps {
  children: ReactNode
}