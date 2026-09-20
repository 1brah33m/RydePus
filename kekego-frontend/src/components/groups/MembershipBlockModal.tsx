import { LogOut, Users, Lock } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface MembershipBlockModalProps {
  open: boolean
  /** Code of the group the student is already a member of. */
  code: string
  leaving: boolean
  /** When set (leave was rejected), show the locked warning instead of actions. */
  warning?: string | null
  onClose: () => void
  onViewGroup: () => void
  onLeaveGroup: () => void
}

/**
 * Shown when a student tries to join (or start) a group while already being
 * part of an active one. Offers to open the current group or leave it. When a
 * leave attempt is rejected (a driver already accepted), renders the warning.
 */
export function MembershipBlockModal({
  open,
  code,
  leaving,
  warning,
  onClose,
  onViewGroup,
  onLeaveGroup,
}: MembershipBlockModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={warning ? "Can't leave this trip" : "You're already in a group"}>
      {warning ? (
        <>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Lock aria-hidden className="size-5" />
            </span>
            <p className="text-sm leading-relaxed text-ink-600 dark:text-slate-300">{warning}</p>
          </div>
          <div className="mt-5">
            <Button size="lg" fullWidth onClick={onClose}>
              Got it
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Users aria-hidden className="size-5" />
            </span>
            <p className="text-sm leading-relaxed text-ink-600 dark:text-slate-300">
              You are already part of an active group{code ? ` (${code})` : ''}. You must leave your current group
              before joining a new one.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <Button size="lg" fullWidth onClick={onViewGroup}>
              View My Group
            </Button>
            <Button size="lg" fullWidth variant="outline" loading={leaving} disabled={leaving} onClick={onLeaveGroup}>
              <LogOut aria-hidden className="size-4" />
              Leave Current Group
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
