import type { ReactNode } from 'react'
import { ShimmeringText } from '@animate-ui/react/primitives/texts/shimmering'
import { Logo } from './Logo'
import { PulseBarsGradient } from './PulseBarsGradient'
import { cn } from '../../utils/cn'

interface AuthSplitLayoutProps {
  title?: string
  subtitle?: string
  children: ReactNode
}

/**
 * Two-column auth shell. The reference login mock is used as a layout guide
 * only: single centered column on mobile, brand panel + form column on `md+`.
 *
 * Everything is our own design tokens (no hard-coded grays/indigos): the form
 * side uses `background`/`foreground`/`muted`, and the brand panel forces the
 * `dark` token scope over a fixed near-black so `Logo` and the keke
 * illustration stay light-on-dark in both modes.
 */
export function AuthSplitLayout({ title, subtitle, children }: AuthSplitLayoutProps) {
  return (
    <div className="flex min-h-full flex-col bg-background md:flex-row">
      {/* Brand panel — desktop only. */}
      <div className="dark relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden p-10 text-foreground md:flex lg:w-1/2 lg:p-12">
        <PulseBarsGradient className="absolute inset-0" />
        <Logo className="relative z-10 animate-ryde-rise" />
        <div className="relative z-10">
          <h2 className="mt-8 animate-ryde-rise animate-delay-150 text-balance font-heading text-5xl font-bold leading-[1.05] tracking-tight">
            <ShimmeringText
              text="Ride together, split the fare."
              duration={2}
              color="var(--foreground)"
              shimmeringColor="#ffffff"
            />
          </h2>
          <p className="mt-3 max-w-sm animate-ryde-rise animate-delay-300 text-base leading-relaxed text-muted-foreground">
            Find campus groups heading your way, split the fare, and share the keke with fellow
            students.
          </p>
        </div>
        <p className="relative z-10 animate-ryde-rise animate-delay-300 text-xs text-muted-foreground">
          Rydepus · Campus rides for students and drivers
        </p>
      </div>

      {/* Form column — full width on mobile, right half on desktop. */}
      <div
        className="flex flex-1 flex-col"
        style={{
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'calc(2.5rem + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(2.5rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="m-auto w-full max-w-sm">
          <Logo className="animate-ryde-rise md:hidden" />
          <div className="mt-10 md:mt-0">
            {title && (
              <h1 className="animate-ryde-rise animate-delay-75 text-[26px] font-bold tracking-tight text-foreground">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1.5 animate-ryde-rise animate-delay-150 text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
            <div className={cn('animate-ryde-rise animate-delay-225', 'mt-8', title ? 'mt-7' : undefined)}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
