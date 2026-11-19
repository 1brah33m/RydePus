import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ArrowRight01Icon, Moon01Icon, SidebarLeftIcon, Sun01Icon } from 'hugeicons-react'
import * as SidebarPrimitive from '@animate-ui/react/primitives/sidebar'
import { Logo } from '../ui/Logo'
import { useTheme } from '../../context/ThemeContext'
import { cn } from '../../utils/cn'

/**
 * Collapsible icon sidebar built on the animate-ui sidebar primitives
 * (collapse engine, cookie persistence, Cmd/Ctrl+B shortcut, mobile
 * detection). Styled purely with this project's sidebar-* design tokens.
 *
 * Desktop only (`lg+`): on mobile this renders nothing — BottomNav covers
 * mobile navigation, so no sheet/drawer dependency is needed.
 */

const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_ICON = '4rem'

export type SidebarIcon = ComponentType<{
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

export interface SidebarNavItem {
  to: string
  label: string
  icon: SidebarIcon
  end?: boolean
}

const { useSidebar } = SidebarPrimitive
export { useSidebar }

export function SidebarProvider({
  className,
  style,
  children,
  ...props
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <SidebarPrimitive.Provider
      data-slot="sidebar-wrapper"
      style={
        {
          '--sidebar-width': SIDEBAR_WIDTH,
          '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
          ...style,
        } as CSSProperties
      }
      className={cn('group/sidebar-wrapper flex min-h-full w-full', className)}
      {...props}
    >
      {children}
    </SidebarPrimitive.Provider>
  )
}

export function Sidebar({ className, children }: { className?: string; children: ReactNode }) {
  const { state, isMobile } = useSidebar()

  // Mobile navigation is owned by BottomNav — the sidebar is desktop only.
  if (isMobile) return null

  return (
    <div
      className={cn('group peer hidden text-sidebar-foreground lg:block', className)}
      data-state={state}
      data-collapsible={state === 'collapsed' ? 'icon' : ''}
      data-side="left"
      data-slot="sidebar"
    >
      {/* Layout placeholder that shrinks/grows with the collapse. */}
      <SidebarPrimitive.Gap
        data-slot="sidebar-gap"
        className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-300 ease-out group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
      />
      <SidebarPrimitive.Container
        data-slot="sidebar-container"
        data-side="left"
        className="fixed inset-y-0 left-0 z-10 hidden h-svh w-(--sidebar-width) border-r border-sidebar-border lg:flex group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
      >
        <SidebarPrimitive.Highlight
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col bg-sidebar"
        >
          {children}
        </SidebarPrimitive.Highlight>
        <SidebarRail />
      </SidebarPrimitive.Container>
    </div>
  )
}

export function SidebarHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div data-slot="sidebar-header" data-sidebar="header" className={cn('flex flex-col gap-2 p-2', className)}>
      {children}
    </div>
  )
}

export function SidebarFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('flex flex-col gap-2 border-t border-sidebar-border p-2', className)}
    >
      {children}
    </div>
  )
}

export function SidebarContent({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn('flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto overflow-x-hidden', className)}
    >
      {children}
    </div>
  )
}

export function SidebarGroup({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div data-slot="sidebar-group" data-sidebar="group" className={cn('relative flex w-full min-w-0 flex-col p-2', className)}>
      {children}
    </div>
  )
}

export function SidebarGroupLabel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SidebarMenu({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <ul data-slot="sidebar-menu" data-sidebar="menu" className={cn('flex w-full min-w-0 flex-col gap-0.5', className)}>
      {children}
    </ul>
  )
}

export function SidebarMenuButton({
  to,
  end,
  icon: Icon,
  label,
  className,
}: {
  to: string
  end?: boolean
  icon: SidebarIcon
  label: string
  className?: string
}) {
  const { state } = useSidebar()
  return (
    <li data-slot="sidebar-menu-item" data-sidebar="menu-item" className="group/menu-item relative">
      <NavLink
        to={to}
        end={end}
        title={state === 'collapsed' ? label : undefined}
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        className={({ isActive }) =>
          cn(
            'flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-xl px-2.5 text-sm font-medium outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            isActive ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'text-sidebar-foreground/70',
            'group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
            className,
          )
        }
      >
        <Icon aria-hidden className="size-4.5 shrink-0" />
        <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
      </NavLink>
    </li>
  )
}

export function SidebarRail({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle sidebar"
      title="Toggle sidebar (Ctrl+B)"
      onClick={toggleSidebar}
      className={cn(
        'absolute inset-y-0 -right-2 z-20 hidden w-4 cursor-ew-resize lg:block',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:bg-transparent after:transition-colors hover:after:bg-sidebar-border',
        className,
      )}
    />
  )
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      onClick={toggleSidebar}
      aria-label="Toggle sidebar"
      title="Toggle sidebar (Ctrl+B)"
      className={cn(
        'flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      <SidebarLeftIcon aria-hidden className="size-5" />
      <span className="sr-only">Toggle sidebar</span>
    </button>
  )
}

export function SidebarInset({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main data-slot="sidebar-inset" className={cn('relative flex w-full flex-1 flex-col bg-background', className)}>
      {children}
    </main>
  )
}

/** Slim top bar with the collapse trigger. Desktop only. */
export function SidebarTopbar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'hidden h-16 shrink-0 items-center gap-2 transition-[width,height] duration-300 ease-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 lg:flex',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
      </div>
    </div>
  )
}

/**
 * Complete sidebar: brand header, flat route menu, profile footer.
 * Shared by the student and driver shells.
 */
export function SidebarNav({
  homeTo,
  brandLabel,
  items,
  userInitials,
  userName,
  userMeta,
  profileTo,
  footerNote,
}: {
  homeTo: string
  brandLabel: string
  items: SidebarNavItem[]
  userInitials: string
  userName: string
  userMeta: string
  profileTo: string
  footerNote: string
}) {
  const { state } = useSidebar()
  const { theme, toggleTheme } = useTheme()
  const collapsed = state === 'collapsed'
  const isDark = theme === 'dark'
  return (
    <Sidebar>
      <SidebarHeader>
        <NavLink
          to={homeTo}
          aria-label={brandLabel}
          className="flex h-12 items-center gap-2.5 rounded-xl px-2 outline-none transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          {collapsed ? <Logo iconOnly /> : <Logo />}
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuButton key={item.to} to={item.to} end={item.end} icon={item.icon} label={item.label} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavLink
          to={profileTo}
          title={`View ${userName} profile`}
          aria-label={`View ${userName} profile`}
          className={({ isActive }) =>
            cn(
              'group/profile flex items-center gap-2.5 rounded-xl border p-2 outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar',
              isActive
                ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground'
                : 'border-transparent hover:border-sidebar-border/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:hover:bg-transparent',
            )
          }
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground ring-1 ring-sidebar-border transition-shadow group-hover/profile:shadow-sm group-data-[collapsible=icon]:ring-0"
          >
            {userInitials}
          </span>
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold leading-tight">{userName}</span>
            <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight text-sidebar-foreground/60">
              {userMeta}
            </span>
          </span>
          <ArrowRight01Icon
            aria-hidden
            className="size-4 shrink-0 text-sidebar-foreground/40 transition-transform duration-200 group-hover/profile:translate-x-0.5 group-data-[collapsible=icon]:hidden"
          />
        </NavLink>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex size-9 items-center justify-center rounded-xl text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:self-center"
        >
          {isDark ? (
            <Sun01Icon aria-hidden className="size-4.5" />
          ) : (
            <Moon01Icon aria-hidden className="size-4.5" />
          )}
        </button>
        <p className="px-3 pb-1 text-[11px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">{footerNote}</p>
      </SidebarFooter>
    </Sidebar>
  )
}
