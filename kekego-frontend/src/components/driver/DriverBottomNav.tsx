import { NavLink } from 'react-router-dom'
import { Home01Icon, InboxIcon, Wallet01Icon, UserCircleIcon } from 'hugeicons-react'
import { cn } from '../../utils/cn'

const tabs = [
  { to: '/driver', label: 'Home', icon: Home01Icon },
  { to: '/driver/requests', label: 'Requests', icon: InboxIcon },
  { to: '/driver/earnings', label: 'Earnings', icon: Wallet01Icon },
  { to: '/driver/profile', label: 'Profile', icon: UserCircleIcon },
] as const

export function DriverBottomNav() {
  return (
    <nav
      aria-label="Driver navigation"
      className="fixed inset-x-4 bottom-0 z-30 lg:hidden"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <ul className="flex items-center gap-1 rounded-3xl border border-border bg-background/70 p-2 shadow-lg backdrop-blur-xl backdrop-saturate-150">
        {tabs.map((tab) => (
          <li key={tab.to} className="min-w-0 flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/driver'}
              aria-label={tab.label}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[11px] font-semibold transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon aria-hidden className="size-5" strokeWidth={isActive ? 2.2 : 1.8} />
                  {tab.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
