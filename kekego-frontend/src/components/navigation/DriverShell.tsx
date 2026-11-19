import type { ReactNode } from 'react'
import { Home01Icon, InboxIcon, UserCircleIcon, Wallet01Icon } from 'hugeicons-react'
import { useAuth } from '../../context/AuthContext'
import { initials } from '../../utils/nameInitials'
import { DriverBottomNav } from '../driver/DriverBottomNav'
import { SidebarInset, SidebarNav, SidebarProvider, SidebarTopbar } from './sidebar'
import type { SidebarNavItem } from './sidebar'

const ITEMS: SidebarNavItem[] = [
  { to: '/driver', label: 'Home', icon: Home01Icon, end: true },
  { to: '/driver/requests', label: 'Requests', icon: InboxIcon },
  { to: '/driver/earnings', label: 'Earnings', icon: Wallet01Icon },
  { to: '/driver/profile', label: 'Profile', icon: UserCircleIcon },
]

/**
 * Shell for driver dashboard pages: collapsible desktop sidebar (lg+) plus
 * a mobile bottom tab bar. Content is centered in `max-w-5xl` with fluid
 * padding.
 */
export function DriverShell({ children }: DriverShellProps) {
  const { student } = useAuth()
  const fullName = student?.fullName?.trim() || 'Driver'
  const parts = fullName.split(/\s+/).filter(Boolean)

  return (
    <SidebarProvider defaultOpen>
      <SidebarNav
        homeTo="/driver"
        brandLabel="Rydepus driver home"
        items={ITEMS}
        userInitials={initials(parts[0] ?? 'Driver', parts.slice(1).join(' ')) || 'D'}
        userName={fullName}
        userMeta="Driver"
        profileTo="/driver/profile"
        footerNote="Rydepus · Campus Shuttle (MVP)"
      />
      <SidebarInset className="min-h-full min-w-0 pb-24 safe-top lg:pb-12">
        <SidebarTopbar />
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 lg:px-8">{children}</div>
        <DriverBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}

interface DriverShellProps {
  children: ReactNode
}
