import { useEffect, useState } from 'react'
import { Cancel01Icon, Sofa01Icon } from 'hugeicons-react'
import { Button } from '../ui/Button'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'

interface JoinSeatsModalProps {
  open: boolean
  /** Empty seats available in the group (upper bound of the choice). */
  max: number
  /** Server-priced fare for one seat. */
  perSeat: number
  /** Preselected count when the dialog opens. */
  initial?: number
  joining?: boolean
  onClose: () => void
  onConfirm: (seats: number) => void
}

/**
 * Join seat picker. The joiner explicitly chooses how many seats to pay for
 * (their own plus any extra), so extra seats are only ever covered by choice —
 * never silently copied from another member's selection.
 */
export function JoinSeatsModal({
  open,
  max,
  perSeat,
  initial = 1,
  joining = false,
  onClose,
  onConfirm,
}: JoinSeatsModalProps) {
  const safeMax = Math.max(1, max)
  const [seats, setSeats] = useState(() => Math.min(Math.max(1, initial), safeMax))

  useEffect(() => {
    if (open) setSeats(Math.min(Math.max(1, initial), safeMax))
  }, [open, initial, safeMax])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose seats to pay for"
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pt-6 shadow-xl sm:my-auto sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">How many seats do you need?</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Cancel01Icon aria-hidden className="size-5" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This group has {safeMax} empty seat{safeMax === 1 ? '' : 's'}. Choose how many you
          are paying for — your own plus any extra. Nothing is covered automatically.
        </p>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Seats to pay for
          </p>
          <div className="mt-2 flex gap-2" role="group" aria-label="Number of seats to pay for">
            {Array.from({ length: safeMax }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSeats(n)}
                aria-pressed={seats === n}
                className={cn(
                  'min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors',
                  seats === n
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Fare per seat</dt>
            <dd className="font-semibold text-foreground">{formatCurrency(perSeat)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Seats you pay for</dt>
            <dd className="flex items-center gap-1.5 font-semibold text-foreground">
              <Sofa01Icon aria-hidden className="size-4" />
              {seats}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <dt className="font-semibold text-foreground">Total on joining</dt>
            <dd className="text-lg font-bold text-foreground">{formatCurrency(perSeat * seats)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2.5">
          <Button size="lg" fullWidth loading={joining} onClick={() => onConfirm(seats)}>
            Join with {seats} seat{seats === 1 ? '' : 's'} · {formatCurrency(perSeat * seats)}
          </Button>
          <Button size="lg" fullWidth variant="outline" onClick={onClose}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
