import { NavLink } from 'react-router-dom'
import { Home, Inbox, Wallet, UserCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

const tabs = [
  { to: '/driver', label: 'Home', icon: Home },
  { to: '/driver/requests', label: 'Requests', icon: Inbox },
  { to: '/driver/earnings', label: 'Earnings', icon: Wallet },
  { to: '/driver/profile', label: 'Profile', icon: UserCircle },
] as const

export function DriverBottomNav() {
  return (
    <nav
      aria-label="Driver navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/70 bg-white/95 backdrop-blur safe-bottom lg:hidden dark:border-white/10 dark:bg-charcoal/95"
    >
      <ul className="flex h-20 items-center justify-around px-2">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.to === '/driver'}
              className="block px-3 py-1.5"
              aria-label={tab.label}
            >
              {({ isActive }) => (
                <span
                  className={cn(
                    'flex min-w-16 flex-col items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400 hover:text-ink-600 dark:text-slate-500 dark:hover:text-slate-300',
                  )}
                >
                  <span className="flex flex-col items-center">
                    <tab.icon
                      aria-hidden
                      className={cn('size-5', isActive && 'drop-shadow-[0_0_8px_rgba(30,58,138,0.6)]')}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 h-1 w-4 rounded-full transition-colors',
                        isActive ? 'bg-brand-500' : 'bg-transparent',
                      )}
                    />
                  </span>
                  {tab.label}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}