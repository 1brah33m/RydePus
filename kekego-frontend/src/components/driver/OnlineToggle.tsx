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
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full py-2 pl-3 pr-2 text-xs font-semibold transition-colors',
        online
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {online ? 'Online' : 'Go Online'}
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          online ? 'bg-primary-foreground/30' : 'bg-foreground/15',
        )}
      >
        <span
          className={cn(
            'inline-block size-4 rounded-full shadow transition-transform',
            online ? 'translate-x-[18px] bg-primary-foreground' : 'translate-x-0.5 bg-background',
          )}
        />
      </span>
    </button>
  )
}