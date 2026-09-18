import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { GroupMember } from '../../types'

interface PassengerSlotsProps {
  members: GroupMember[]
  maxSlots?: number
  /** When true, an empty seat shows a live "waiting" label. */
  waitingLabel?: string
}

export function PassengerSlots({ members, maxSlots = 4, waitingLabel = 'Waiting' }: PassengerSlotsProps) {
  const slots = Array.from({ length: maxSlots })

  return (
    <ul className="divide-y divide-ink-100 dark:divide-white/5">
      {slots.map((_, i) => {
        const member = members[i]
        return (
          <li key={member?.id ?? `empty-${i}`} className="flex items-center gap-2.5 py-2">
            {member ? (
              <CheckCircle2 aria-hidden className="size-5 shrink-0 text-brand-600 dark:text-brand-400" />
            ) : (
              <Circle aria-hidden className="size-5 shrink-0 text-ink-300 dark:text-slate-600" />
            )}
            <span
              className={cn(
                'truncate text-sm',
                member ? 'font-medium text-ink-800 dark:text-slate-200' : 'text-ink-400 dark:text-slate-500',
              )}
            >
              {member ? member.name : waitingLabel}
            </span>
            {member?.isCurrentUser && (
              <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                You
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}