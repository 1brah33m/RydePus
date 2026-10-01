import { CheckCircle2, Circle, CreditCard } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { GroupMember } from '../../types'

interface PassengerSlotsProps {
  members: GroupMember[]
  maxSlots?: number
  /** When true, an empty seat shows a live "waiting" label. */
  waitingLabel?: string
  /** Seats covered by a buyout; rendered as paid-for slots after the members. */
  boughtSeats?: number
}

export function PassengerSlots({
  members,
  maxSlots = 4,
  waitingLabel = 'Waiting',
  boughtSeats = 0,
}: PassengerSlotsProps) {
  const paid = Math.min(boughtSeats, Math.max(0, maxSlots - members.length))
  const rows = [
    ...members.map((member, index) => ({ key: member.id, kind: 'member' as const, member, index })),
    ...Array.from({ length: paid }, (_, i) => ({ key: `paid-${i}`, kind: 'paid' as const, index: members.length + i })),
  ]
  const total = Math.max(maxSlots, members.length + paid)

  return (
    <ul className="divide-y divide-ink-100 dark:divide-white/5">
      {Array.from({ length: total }, (_, i) => {
        const row = rows[i]
        const member = row?.kind === 'member' ? row.member : undefined
        const isPaid = row?.kind === 'paid'
        return (
          <li key={member?.id ?? (isPaid ? `paid-${row?.index ?? i}` : `empty-${i}`)} className="flex items-center gap-2.5 py-2">
            {isPaid ? (
              <CreditCard aria-hidden className="size-5 shrink-0 text-brand-600 dark:text-brand-400" />
            ) : member ? (
              <CheckCircle2 aria-hidden className="size-5 shrink-0 text-brand-600 dark:text-brand-400" />
            ) : (
              <Circle aria-hidden className="size-5 shrink-0 text-ink-300 dark:text-slate-600" />
            )}
            <span
              className={cn(
                'truncate text-sm',
                member || isPaid ? 'font-medium text-ink-800 dark:text-slate-200' : 'text-ink-400 dark:text-slate-500',
              )}
            >
              {member ? member.name : isPaid ? 'Seat paid for' : waitingLabel}
            </span>
            {member?.isCurrentUser && (
              <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                You
              </span>
            )}
            {isPaid && (
              <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                Paid
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}