import { NavLink } from 'react-router-dom'
import { Home, Users, Map, Wallet } from 'lucide-react'
import { cn } from '../../utils/cn'

const tabs = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/trips', label: 'Trips', icon: Map },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
] as const

export function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/70 bg-white/95 backdrop-blur safe-bottom lg:hidden dark:border-slate-800 dark:bg-charcoal/95"
    >
      <ul className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.to === '/home'}
              className={({ isActive }) =>
                cn(
                  'flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-ink-400 hover:text-ink-600 dark:text-slate-500 dark:hover:text-slate-300',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon aria-hidden className={cn('size-5', isActive && 'text-brand-600 dark:text-brand-400')} strokeWidth={isActive ? 2.2 : 1.8} />
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