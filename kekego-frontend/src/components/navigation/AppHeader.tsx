import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface AppHeaderProps {
  title: string
  onBack?: () => void
  right?: ReactNode
}

export function AppHeader({ title, onBack, right }: AppHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 -mx-4 h-14 w-[calc(100%+2rem)] border-b border-ink-200/70 bg-white/90 px-4 backdrop-blur sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 lg:-mx-8 lg:w-[calc(100%+4rem)] lg:px-8 dark:border-slate-800 dark:bg-charcoal/90">
      <div className="mx-auto flex h-full w-full max-w-5xl items-center gap-2">
        <button
          type="button"
          onClick={onBack ?? (() => navigate(-1))}
          aria-label="Go back"
          className="-ml-2 flex size-9 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <ArrowLeft aria-hidden className="size-5" />
        </button>
        <h1 className="flex-1 truncate text-base font-semibold text-ink-900 dark:text-slate-100">{title}</h1>
        {right}
      </div>
    </header>
  )
}