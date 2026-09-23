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
          ? 'bg-brand-50 text-brand-600 shadow-[0_0_0_1px_rgba(30,58,138,0.4)] dark:bg-brand-500/15 dark:text-brand-400 dark:shadow-[0_0_0_1px_rgba(30,58,138,0.4)]'
          : 'bg-ink-100 text-ink-600 shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-white/5 dark:text-slate-400 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
      )}
    >
      {online ? 'Online' : 'Go Online'}
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          online ? 'bg-brand-500' : 'bg-ink-300 dark:bg-slate-600',
        )}
      >
        <span
          className={cn(
            'inline-block size-4 rounded-full bg-white shadow transition-transform',
            online ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}