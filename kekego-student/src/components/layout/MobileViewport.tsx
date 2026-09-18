import type { ReactNode } from 'react'

interface MobileViewportProps {
  children: ReactNode
}

/**
 * Global full-viewport scroll container. On mobile this is a single
 * full-height column (bottom nav fixed over it); on desktop the whole app
 * flows naturally across the full window width with a fallback background
 * behind pages that paint their own surface.
 */
export function MobileViewport({ children }: MobileViewportProps) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-ink-50 dark:bg-charcoal">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden lg:overscroll-contain">{children}</div>
    </div>
  )
}