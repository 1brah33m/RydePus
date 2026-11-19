import type Lenis from 'lenis'

let instance: Lenis | null = null

export function setLenisInstance(lenis: Lenis | null) {
  instance = lenis
}

export function getLenisInstance(): Lenis | null {
  return instance
}

export function getScrollRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>('[data-scroll-root]')
}

/**
 * Smooth-scroll to a landing section. Uses the active Lenis instance when
 * present (landing page), otherwise falls back to native smooth scrolling.
 * `id` is a DOM id without the `#` — pass 'top' to go to the very top.
 */
export function scrollToSection(id: string, opts?: { offset?: number; duration?: number }) {
  const offset = opts?.offset ?? -64
  const duration = opts?.duration ?? 1.2

  if (typeof document === 'undefined') return

  if (id === 'top') {
    if (instance) {
      instance.scrollTo(0, { duration })
    } else {
      const root = getScrollRoot()
      if (root) root.scrollTo({ top: 0, behavior: 'smooth' })
      else window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    return
  }

  const selector = `#${CSS.escape(id)}`

  if (instance) {
    instance.scrollTo(selector, { offset, duration })
    return
  }

  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
