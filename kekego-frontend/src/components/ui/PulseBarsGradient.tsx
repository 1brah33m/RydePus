import { useEffect, useRef } from 'react'

/**
 * "uu" gradient from 21st.dev (Silk Blend), recolored with this project's
 * design tokens: a smooth, silky linear gradient plus the spec's faint film
 * grain overlay. Static edition — drawn once on canvas, re-drawn on resize
 * or theme change.
 *
 * Token mapping (dark→light grayscale ramp mirroring the spec):
 * backdrop --background, stops --background @ 0%, --secondary @ 32%,
 * --accent @ 100%. Angle 170, scale 68, center 50/50.
 */

const SCALE = 68
const CENTER = 50
const ANGLE_DEG = 170
const SEED = 425513060
// Subtle static waviness (spec wave 12 / distortion 28): slice amplitude in px.
const WAVE_AMP = 3.5

type RGB = [number, number, number]

const TOKEN_VARS = ['--background', '--secondary', '--accent'] as const

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

function css(rgb: RGB, alpha = 1) {
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`
}

/**
 * Parse `oklch(L C H [/ A])` (or plain rgb/hex) to sRGB 0-255.
 * Done in JS because canvas fillStyle parsing of oklch is unreliable.
 */
function parseToRgb(raw: string, fallback: RGB): RGB {
  const value = raw.trim()
  if (!value) return fallback
  const oklch = value.match(
    /^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)$/,
  )
  if (oklch) {
    const L = parseFloat(oklch[1])
    const C = parseFloat(oklch[2])
    const H = (parseFloat(oklch[3]) * Math.PI) / 180
    if (![L, C, H].every(Number.isFinite)) return fallback
    const a = C * Math.cos(H)
    const b = C * Math.sin(H)
    const l = L + 0.3963377774 * a + 0.2158037573 * b
    const m = L - 0.1055613458 * a - 0.0638541728 * b
    const s = L - 0.0894841775 * a - 1.291485548 * b
    const l3 = l * l * l
    const m3 = m * m * m
    const s3 = s * s * s
    const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
    const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
    const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3
    const gamma = (u: number) => {
      const clamped = Math.min(1, Math.max(0, u))
      const v = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
      return Math.min(255, Math.max(0, Math.round(v * 255)))
    }
    return [gamma(r), gamma(g), gamma(bl)]
  }
  const rgb = value.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/)
  if (rgb) return [parseFloat(rgb[1]), parseFloat(rgb[2]), parseFloat(rgb[3])]
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  return fallback
}

function tokenRgb(el: Element, name: string, fallback: RGB): RGB {
  return parseToRgb(getComputedStyle(el).getPropertyValue(name), fallback)
}

/** Sample the (scale/center-mapped) palette at a 0-100 position. */
function samplePalette(stops: { pos: number; rgb: RGB }[], edge: RGB, mapped: number): RGB {
  const pos = 50 + ((mapped - CENTER) / SCALE) * 100
  if (pos <= stops[0].pos) return stops[0].rgb
  for (let i = 1; i < stops.length; i += 1) {
    if (pos <= stops[i].pos) {
      const prev = stops[i - 1]
      return mix(prev.rgb, stops[i].rgb, (pos - prev.pos) / (stops[i].pos - prev.pos))
    }
  }
  return edge
}

// Deterministic wave phase (static render, so it never moves).
const rand = mulberry32(SEED)
const WAVE_PHASE = rand() * Math.PI * 2
const WAVE_FREQ = 2.2

function draw(
  ctx: CanvasRenderingContext2D,
  tokens: Record<(typeof TOKEN_VARS)[number], RGB>,
  w: number,
  h: number,
) {
  const backdrop = tokens['--background']
  const stops = [
    { pos: 0, rgb: tokens['--background'] },
    { pos: 32, rgb: tokens['--secondary'] },
    { pos: 100, rgb: tokens['--accent'] },
  ]

  // Base silk gradient along the 170deg axis, scale-mapped around the center.
  const rad = (ANGLE_DEG * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const len = Math.abs(w * dx) + Math.abs(h * dy)
  const cx = w / 2
  const cy = h / 2
  const offscreen = document.createElement('canvas')
  offscreen.width = Math.max(1, Math.floor(w))
  offscreen.height = Math.max(1, Math.floor(h))
  const octx = offscreen.getContext('2d')
  if (!octx) return
  const g = octx.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2)
  const steps = 64
  for (let s = 0; s <= steps; s += 1) {
    const f = s / steps
    g.addColorStop(f, css(samplePalette(stops, stops[stops.length - 1].rgb, f * 100)))
  }
  octx.fillStyle = css(backdrop)
  octx.fillRect(0, 0, w, h)
  octx.fillStyle = g
  octx.fillRect(0, 0, w, h)

  // Subtle static waviness: composite back in horizontal slices with a small
  // sine x-offset (spec wave/distortion, frozen — animated is false).
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = css(backdrop)
  ctx.fillRect(0, 0, w, h)
  const slice = 4
  for (let y = 0; y < h; y += slice) {
    const sh = Math.min(slice, h - y)
    const ox = WAVE_AMP * Math.sin((y / h) * Math.PI * WAVE_FREQ + WAVE_PHASE)
    ctx.drawImage(offscreen, 0, y, w, sh, ox, y, w, sh)
  }
}

const GRAIN_SVG_URL =
  "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.130'/></svg>\")"

/** Static CSS approximation using the project tokens (first paint fallback). */
const FALLBACK_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--background)',
  backgroundImage: `${GRAIN_SVG_URL}, linear-gradient(170deg, var(--background) 0%, var(--secondary) 32%, var(--accent) 100%)`,
  backgroundSize: '120px 120px, auto',
  backgroundBlendMode: 'overlay, normal',
}

// Fallbacks used only when a token var is entirely missing.
const FALLBACK_RGB: Record<(typeof TOKEN_VARS)[number], RGB> = {
  '--background': [23, 23, 23],
  '--secondary': [38, 38, 38],
  '--accent': [64, 64, 64],
}

export function PulseBarsGradient({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const host: Element = canvas.parentElement ?? canvas

    const render = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      if (w <= 0 || h <= 0) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const tokens = {} as Record<(typeof TOKEN_VARS)[number], RGB>
      for (const name of TOKEN_VARS) tokens[name] = tokenRgb(host, name, FALLBACK_RGB[name])
      draw(ctx, tokens, w, h)
    }

    render()
    const observer = new ResizeObserver(render)
    if (canvas.parentElement) observer.observe(canvas.parentElement)
    // Redraw when the theme scope flips (ThemeContext toggles .dark on <html>).
    const themeObserver = new MutationObserver(render)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      observer.disconnect()
      themeObserver.disconnect()
    }
  }, [])

  return (
    <div className={className} style={FALLBACK_STYLE} aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: GRAIN_SVG_URL, backgroundSize: '120px 120px', mixBlendMode: 'overlay' }}
      />
    </div>
  )
}
