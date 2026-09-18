import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

type UpdateSW = ReturnType<typeof registerSW>

let registered = false

/**
 * Floating banner shown when the service worker finds a newer build.
 * The "Reload" button applies the update and reloads the app, so stale
 * cached bundles (the reason old UI persisted after deploys) are replaced.
 */
export function PwaUpdateBanner() {
  const [shown, setShown] = useState(false)
  const updateSWRef = useRef<UpdateSW | null>(null)

  useEffect(() => {
    // Singleton: React StrictMode (dev) double-invokes effects; do not
    // register the service worker twice.
    if (registered) return
    registered = true
    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setShown(true),
      onOfflineReady: () => {},
    })
  }, [])

  if (!shown) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[60] px-4 pt-4">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white p-3 pl-4 shadow-2xl dark:border-slate-700 dark:bg-[#1E1E1E]">
        <p className="text-sm font-medium leading-snug text-ink-800 dark:text-slate-200">
          A new version of KekeGo is available.
        </p>
        <button
          type="button"
          onClick={() => updateSWRef.current?.(true)}
          className="shrink-0 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-600 dark:text-charcoal"
        >
          Reload
        </button>
      </div>
    </div>
  )
}