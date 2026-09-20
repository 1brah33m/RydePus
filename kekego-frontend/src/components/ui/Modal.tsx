import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  panelClassName?: string
}

export function Modal({ open, onClose, title, children, panelClassName }: ModalProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink-900/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pt-6 shadow-xl sm:my-auto sm:rounded-3xl dark:border dark:border-slate-800 dark:bg-[#1E1E1E]',
          panelClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 dark:text-slate-400 dark:hover:bg-white/10"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}