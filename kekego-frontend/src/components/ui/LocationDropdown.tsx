import { DropdownMenu as DropdownMenuPrimitive } from '@animate-ui/react/primitives/radix-ui'
import { ArrowDown01Icon, Tick02Icon } from 'hugeicons-react'
import { cn } from '../../utils/cn'
import type { SelectOption } from './Select'

interface LocationDropdownProps {
  ariaLabel: string
  placeholder: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
}

/**
 * Animated location picker built on the Animate UI dropdown primitives.
 * Replaces the native <select> in the dashboard hero so the list matches
 * the project tokens (bg-popover / border-border) in light and dark mode.
 */
export function LocationDropdown({ ariaLabel, placeholder, value, options, onChange }: LocationDropdownProps) {
  const selected = options.find((o) => o.value === value)

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger
        aria-label={ariaLabel}
        className="flex h-9 w-full items-center justify-between gap-2 bg-transparent p-0 text-left text-sm font-semibold text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'font-medium text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <ArrowDown01Icon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180 [[data-state=open]>&]:rotate-180"
        />
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          side="bottom"
          sideOffset={8}
          className="z-50 max-h-64 w-(--radix-dropdown-menu-trigger-width) min-w-56 origin-top overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none"
        >
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <DropdownMenuPrimitive.Item
                key={opt.value}
                onSelect={() => onChange(opt.value)}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors',
                  active
                    ? 'bg-accent font-semibold text-accent-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                {active && <Tick02Icon aria-hidden className="size-4 shrink-0" />}
              </DropdownMenuPrimitive.Item>
            )
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
