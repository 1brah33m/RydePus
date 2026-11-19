import { useNavigate } from 'react-router-dom'
import { ArrowLeft01Icon } from 'hugeicons-react'
import type { ReactNode } from 'react'

interface AppHeaderProps {
  title: string
  onBack?: () => void
  right?: ReactNode
}

export function AppHeader({ title, onBack, right }: AppHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 -mx-4 h-14 w-[calc(100%+2rem)] border-b border-border bg-background/80 px-4 backdrop-blur sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 lg:-mx-8 lg:w-[calc(100%+4rem)] lg:px-8">
      <div className="mx-auto flex h-full w-full max-w-5xl items-center gap-2">
        <button
          type="button"
          onClick={onBack ?? (() => navigate(-1))}
          aria-label="Go back"
          className="-ml-2 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft01Icon aria-hidden className="size-5" />
        </button>
        <h1 className="flex-1 truncate text-base font-semibold text-foreground">{title}</h1>
        {right}
      </div>
    </header>
  )
}