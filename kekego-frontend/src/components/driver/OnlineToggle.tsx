import { cn } from '../../utils/cn'

interface OnlineToggleProps {
  online: boolean
  onToggle: () => void
}

export function OnlineToggle({ online, onToggle }: OnlineToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={online}
      onClick={onToggle}
      className="flex shrink-0 items-center gap-3 rounded-2xl border border-border bg-card py-2.5 pr-2.5 pl-4 transition-colors hover:border-ring"
    >
      <span className="text-left">
        <span className="flex items-center gap-1.5 text-sm font-bold whitespace-nowrap text-foreground">
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              online ? 'animate-pulse bg-blue-500' : 'bg-muted-foreground/50',
            )}
          />
          {online ? 'Online' : 'Offline'}
        </span>
        <span className="mt-0.5 block text-xs whitespace-nowrap text-muted-foreground">
          {online ? 'Accepting rides' : 'Paused'}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-7 w-12 items-center rounded-full transition-colors',
          online ? 'bg-blue-500' : 'bg-foreground/15',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow transition-transform',
            online ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </span>
    </button>
  )
}
