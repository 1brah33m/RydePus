import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getScrollRoot, setLenisInstance } from '../lib/lenis'

/**
 * Mount Lenis smooth scrolling for the landing page only.
 *
 * The app scrolls inside the `[data-scroll-root]` container rendered by
 * `MobileViewport` (not `window`), so Lenis is bound to that wrapper and
 * destroyed on unmount — other app screens keep native scrolling.
 */
export function useLandingLenis() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const root = getScrollRoot()
    if (!root) return

    const content = root.firstElementChild as HTMLElement | null

    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis({
      wrapper: root,
      content: content ?? undefined,
      lerp: 0.1,
      smoothWheel: true,
      anchors: true,
    })
    setLenisInstance(lenis)

    // Single clock for Lenis + ScrollTrigger (recommended): GSAP's ticker
    // drives Lenis, and every Lenis scroll notifies ScrollTrigger.
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    // Start at the top (the scroll container persists across routes) and
    // re-measure triggers now that the wrapper is Lenis-driven.
    lenis.scrollTo(0, { immediate: true })
    ScrollTrigger.refresh()

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      setLenisInstance(null)
      ScrollTrigger.refresh()
    }
  }, [])
}
