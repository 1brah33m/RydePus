import { cn } from '../../utils/cn'

interface StepBarProps {
  current: 1 | 2
  total?: 2
  labels?: [string, string]
  className?: string
}

export function StepBar({ current, total = 2, labels, className }: StepBarProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Step ${current} of ${total}`}
      className={cn('mb-5 w-full', className)}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          Step {current} of {total}
        </span>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const active = i < current
          return (
            <span
              key={i}
              className={cn('h-1 flex-1 rounded-full transition-colors', active ? 'bg-primary' : 'bg-muted')}
            />
          )
        })}
      </div>
      {labels && (
        <div className="mt-1.5 flex gap-1.5" aria-hidden>
          {labels.map((label, i) => (
            <span
              key={label}
              className={cn(
                'flex-1 text-[11px] font-medium',
                i < current ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
