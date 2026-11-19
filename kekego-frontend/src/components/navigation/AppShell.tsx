import type { ReactNode } from 'react'
import { Home01Icon, MapsIcon, UserGroupIcon, Wallet01Icon } from 'hugeicons-react'
import { useAuth } from '../../context/AuthContext'
import { initials } from '../../utils/nameInitials'
import { BottomNav } from './BottomNav'
import { SidebarInset, SidebarNav, SidebarProvider, SidebarTopbar } from './sidebar'
import type { SidebarNavItem } from './sidebar'

const ITEMS: SidebarNavItem[] = [
  { to: '/home', label: 'Home', icon: Home01Icon, end: true },
  { to: '/groups', label: 'Groups', icon: UserGroupIcon },
  { to: '/trips', label: 'Trips', icon: MapsIcon },
  { to: '/wallet', label: 'Wallet', icon: Wallet01Icon },
]

/**
 * Application shell for student pages: collapsible desktop sidebar (lg+)
 * plus a mobile bottom tab bar. Content stays centered in a `max-w-5xl`
 * column with fluid padding on every screen size.
 */
export function AppShell({ children }: AppShellProps) {
  const { student } = useAuth()
  const fullName = student?.fullName?.trim() || 'Student'
  const parts = fullName.split(/\s+/).filter(Boolean)

  return (
    <SidebarProvider defaultOpen>
      <SidebarNav
        homeTo="/home"
        brandLabel="Rydepus home"
        items={ITEMS}
        userInitials={initials(parts[0] ?? 'Student', parts.slice(1).join(' ')) || 'S'}
        userName={fullName}
        userMeta="Student"
        profileTo="/profile"
        footerNote="Rydepus · Campus Shuttle (MVP)"
      />
      <SidebarInset className="min-h-full min-w-0 pb-24 safe-top lg:pb-12">
        <SidebarTopbar />
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 lg:px-8">{children}</div>
        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}

interface AppShellProps {
  children: ReactNode
}
