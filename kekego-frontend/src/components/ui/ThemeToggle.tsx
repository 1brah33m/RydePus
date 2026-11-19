import { Moon01Icon, Sun01Icon } from 'hugeicons-react'
import { useTheme } from '../../context/ThemeContext'
import { cn } from '../../utils/cn'

interface ThemeToggleProps {
  className?: string
}

/**
 * Accessible sliding switch for light/dark theme. Displays a sun/moon icon
 * and slides a knob left (light) or right (dark).
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors',
        isDark ? 'bg-primary' : 'bg-muted border border-border',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-6 items-center justify-center rounded-full bg-card shadow-sm transition-transform',
          isDark ? 'translate-x-7' : 'translate-x-1',
        )}
      >
        {isDark ? (
          <Moon01Icon className="size-3.5 text-foreground" />
        ) : (
          <Sun01Icon className="size-3.5 text-amber-500" />
        )}
      </span>
    </button>
  )
}