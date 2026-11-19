import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUpDownIcon,
  Cancel01Icon,
  MapPinIcon,
  Menu01Icon,
  UserGroupIcon,
  Wallet01Icon,
} from 'hugeicons-react'
import { cn } from '../../utils/cn'
import { RMark } from '../../components/ui/Logo'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion'
import { CAMPUS_LOCATIONS } from '../../config/locations'
import { distanceKm, perSeatFare } from '../../config/pricing'
import { formatCurrency } from '../../utils/format'
import { getScrollRoot, scrollToSection } from '../../lib/lenis'
import { useLandingLenis } from '../../hooks/useLandingLenis'

const NAV_LINKS: { label: string; id: string }[] = [
  { label: 'Fares', id: 'fares' },
  { label: 'Steps', id: 'steps' },
  { label: 'Earn', id: 'earn' },
  { label: 'FAQ', id: 'faq' },
]

type PopularRoute = { from: string; to: string }

const POPULAR_ROUTES: PopularRoute[] = [
  { from: 'main-gate', to: 'hostelFemale' },
  { from: 'hostelMale', to: 'lecture-theatre' },
  { from: 'main-gate', to: 'lecture-theatre' },
  { from: 'soa', to: 'hostelFemale' },
  { from: 'ECE', to: 'hostelMale' },
  { from: 'staff-club', to: 'main-mosque' },
]

/** Two-letter codes printed on the ticket stubs. */
const STOP_CODES: Record<string, string> = {
  'main-gate': 'MG',
  soa: 'SA',
  EVM: 'ES',
  ECE: 'EC',
  hostelFemale: 'HF',
  hostelMale: 'HM',
  'lecture-theatre': 'LT',
  'staff-club': 'SC',
  CHE: 'CH',
  'main-mosque': 'MQ',
}

function stopCode(id: string): string {
  return STOP_CODES[id] ?? id.slice(0, 2).toUpperCase()
}

const FAQS = [
  {
    q: 'How is the fare set?',
    a: 'Straight-line distance between your two stops, at a fixed per-km rate with a floor and rounded to the nearest ₦50. The booking card and the fare board below run the same function — what you see is what the group pays per seat.',
  },
  {
    q: 'Why four seats?',
    a: 'A keke leaves when all four seats fill. No half-full departures, no haggling at the park. Your group page shows each seat as it fills.',
  },
  {
    q: 'Who can ride or drive?',
    a: 'Riders are verified students. Drivers are students or campus operators whose identity and keke have been checked. Only the ten listed stops are served.',
  },
  {
    q: 'Where do I track my trip?',
    a: 'After joining, the group page records driver, seats and route. Share it from the Trips page. Anything off — wrong driver, wrong route — report it from your profile.',
  },
  {
    q: 'How do drivers get paid?',
    a: 'Each seat fare lands in the driver wallet per trip. The exact split is shown inside the driver app before you accept, and withdrawals go to a bank account on payout days.',
  },
]

function rideMinutes(pickupId: string, destId: string): number | null {
  const km = distanceKm(pickupId, destId)
  if (km === null) return null
  return Math.max(5, Math.round(km * 8 + 3))
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-64px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Public marketing page — transit-system reading, not SaaS hero.
 * Strict project tokens only: background, foreground, card, muted,
 * primary, secondary, accent, border, ring, radius, fonts, shadows.
 */
export function LandingPage() {
  useLandingLenis()
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-full bg-background font-sans text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main">
          <HeroSection />
          <ValueProps />
          <FareBoard />
          <StepsSection />
          <EarnSection />
          <FaqSection />
          <CloseBand />
        </main>
        <FooterSection />
      </div>
    </MotionConfig>
  )
}

/* ------------------------------------------------------------------ */
/* Navbar                                                              */
/* ------------------------------------------------------------------ */

function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const root = getScrollRoot()
    const onScroll = () => setScrolled((root?.scrollTop ?? window.scrollY) > 8)
    onScroll()
    root?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root?.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const scrollTo = (id: string) => {
    setOpen(false)
    scrollToSection(id)
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b transition-colors',
        scrolled || open ? 'border-border bg-background/90 backdrop-blur' : 'border-transparent bg-background',
      )}
    >
      <nav aria-label="Primary" className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => scrollTo('top')}
          className="flex items-center gap-2 rounded-md"
          aria-label="Rydepus — back to top"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/15">
            <RMark className="text-lg" />
          </span>
          <span className="font-heading text-lg font-bold tracking-tight">
            Ryde<span className="text-primary">pus</span>
          </span>
        </button>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="btn-press rounded-lg px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => navigate('/register/student')}
            className="btn-press inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Find a seat
            <ArrowRight01Icon aria-hidden className="size-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="flex size-11 items-center justify-center rounded-lg text-foreground lg:hidden"
        >
          {open ? <Cancel01Icon aria-hidden className="size-6" /> : <Menu01Icon aria-hidden className="size-6" />}
        </button>
      </nav>

      {open && (
        <div id="mobile-nav" className="border-t border-border bg-background px-4 pb-5 pt-2 sm:px-6 lg:hidden">
          {NAV_LINKS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className="block w-full rounded-md px-3 py-3 text-left text-[15px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </button>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/login')
              }}
              className="min-h-12 rounded-lg border border-border px-4 py-3 text-sm font-bold"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/register/student')
              }}
              className="min-h-12 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              Find a seat
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Hero — route task first                                             */
/* ------------------------------------------------------------------ */

function HeroSection() {
  const navigate = useNavigate()
  const [pickup, setPickup] = useState('main-gate')
  const [destination, setDestination] = useState('hostelFemale')
  const [touched, setTouched] = useState(false)
  const fares = useMemo(() => POPULAR_ROUTES.map((r) => perSeatFare(r.from, r.to)), [])
  const minFare = Math.min(...fares)
  const maxFare = Math.max(...fares)

  const setRoute = (p: string, d: string) => {
    setPickup(p)
    setDestination(d)
    setTouched(true)
  }

  return (
    <section id="top" aria-labelledby="hero-heading" className="flex min-h-[calc(100dvh-4rem)] scroll-mt-16 items-center border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-12 lg:px-8">
        <div>
          <h1
            id="hero-heading"
            className="max-w-xl text-balance font-heading text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl"
          >
            Pick two stops. See your seat fare.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Main Gate, hostels, lecture halls. Fares run {formatCurrency(minFare)} to{' '}
            {formatCurrency(maxFare)} per seat, set by distance and shown before you join.
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate('/register/student')}
              className="btn-press inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground"
            >
              Find a seat
              <ArrowRight01Icon aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('earn')}
              className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg px-4 py-3.5 text-base font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Drive instead
              <ArrowRight01Icon aria-hidden className="size-4" />
            </button>
          </div>
          <p className="mt-6 font-mono text-xs tabular-nums text-muted-foreground">
            {CAMPUS_LOCATIONS.length} fixed stops on campus
          </p>
        </div>

        <div id="book" className="scroll-mt-20 lg:justify-self-end">
          <BookingCard pickup={pickup} destination={destination} touched={touched} onRouteChange={setRoute} />
        </div>
      </div>
    </section>
  )
}

function BookingCard({
  pickup,
  destination,
  touched,
  onRouteChange,
}: {
  pickup: string
  destination: string
  touched: boolean
  onRouteChange: (pickup: string, destination: string) => void
}) {
  const navigate = useNavigate()

  const quote = useMemo(() => {
    if (!pickup || !destination || pickup === destination) return null
    return {
      fare: perSeatFare(pickup, destination),
      km: distanceKm(pickup, destination),
    }
  }, [pickup, destination])

  const showHint = touched && !quote

  const fieldWrap =
    'flex items-center gap-2 rounded-lg border border-border bg-background py-1.5 pl-1.5 pr-3 transition-colors focus-within:border-ring'
  const fieldSelect = (filled: boolean) =>
    cn(
      'w-full appearance-none bg-transparent py-2 text-[15px] outline-none',
      filled ? 'font-medium text-foreground' : 'text-muted-foreground',
    )

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="p-5 sm:p-6">
        <div>
          <label htmlFor="pickup" className="block font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            From
          </label>
          <div className={cn(fieldWrap, 'mt-1.5')}>
            <span aria-hidden className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold tabular-nums">
              {stopCode(pickup)}
            </span>
            <select
              id="pickup"
              value={pickup}
              onChange={(e) => onRouteChange(e.target.value, destination)}
              className={fieldSelect(Boolean(pickup))}
              aria-label="Pickup stop"
            >
              <option value="">Select stop</option>
              {CAMPUS_LOCATIONS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <ArrowDown01Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-stretch gap-3">
          <span aria-hidden className="ml-[27px] w-px bg-border" />
          <div className="flex flex-1 items-center justify-end py-1">
            <button
              type="button"
              onClick={() => onRouteChange(destination, pickup)}
              aria-label="Swap stops"
              className="btn-press flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-ring hover:text-foreground"
            >
              <ArrowUpDownIcon aria-hidden className="size-4" />
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="destination" className="block font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            To
          </label>
          <div className={cn(fieldWrap, 'mt-1.5')}>
            <span aria-hidden className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold tabular-nums">
              {stopCode(destination)}
            </span>
            <select
              id="destination"
              value={destination}
              onChange={(e) => onRouteChange(pickup, e.target.value)}
              className={fieldSelect(Boolean(destination))}
              aria-label="Destination stop"
            >
              <option value="">Select stop</option>
              {CAMPUS_LOCATIONS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <ArrowDown01Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <div aria-live="polite" className="mt-4 min-h-5">
          <AnimatePresence mode="wait" initial={false}>
            {quote ? (
              <motion.p
                key={`${pickup}-${destination}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="font-mono text-sm tabular-nums text-muted-foreground"
              >
                <span className="font-bold text-foreground">{formatCurrency(quote.fare)}</span> / seat
                {quote.km !== null ? ` · ${quote.km.toFixed(1)} km` : ''} · {stopCode(pickup)} → {stopCode(destination)}
              </motion.p>
            ) : (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn('text-[13px] leading-relaxed', showHint ? 'font-medium text-foreground' : 'text-muted-foreground')}
              >
                {showHint ? 'Pick two different stops to see the seat fare.' : 'Fares are distance-set. You always see the price first.'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => navigate('/register/student')}
          disabled={!quote}
          className="btn-press mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-[15px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue — {quote ? formatCurrency(quote.fare) : 'select stops'}
          <ArrowRight01Icon aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Why Rydepus — stats + benefits                                      */
/* ------------------------------------------------------------------ */

function ValueProps() {
  const fares = useMemo(() => POPULAR_ROUTES.map((r) => perSeatFare(r.from, r.to)), [])
  const minFare = Math.min(...fares)
  const maxFare = Math.max(...fares)
  const avgMins = useMemo(() => {
    const minutes = POPULAR_ROUTES.map((r) => rideMinutes(r.from, r.to)).filter((n): n is number => n !== null)
    if (minutes.length === 0) return null
    return Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)
  }, [])

  const stats = [
    { value: `${CAMPUS_LOCATIONS.length} stops`, label: 'Fixed campus line' },
    { value: '4 seats', label: 'Full keke leaves together' },
    { value: `${formatCurrency(minFare)}–${formatCurrency(maxFare)}`, label: 'Per-seat fare range' },
    { value: avgMins === null ? '—' : `~${avgMins} min`, label: 'Typical corridor ride' },
  ]

  const benefits = [
    {
      icon: Wallet01Icon,
      title: 'Upfront seat fare',
      text: 'Distance-set price shown before you join. No haggling at the park.',
    },
    {
      icon: UserGroupIcon,
      title: 'Groups of four',
      text: 'Kekes leave when all four seats fill. Track each seat live.',
    },
    {
      icon: MapPinIcon,
      title: 'Campus stops only',
      text: 'Main Gate to hostels, halls and mosque. No detours, no wrong pins.',
    },
  ]

  return (
    <section aria-labelledby="why-heading">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Why Rydepus</p>
          <h2 id="why-heading" className="mt-2 max-w-xl font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Built for the campus run.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            Fixed stops, per-seat fares, groups of four. The fare board below prices off the same numbers.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-8">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-card px-5 py-4">
                <dt className="order-2 mt-1 text-[13px] leading-snug text-muted-foreground">{s.label}</dt>
                <dd className="font-mono text-base font-bold tabular-nums tracking-tight">{s.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={0.05 * i}>
              <li className="h-full rounded-xl border border-border bg-card p-5 shadow-sm">
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  <b.icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold tracking-tight">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.text}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Fare board — ledger, not cards                                      */
/* ------------------------------------------------------------------ */

function FareBoard() {
  const navigate = useNavigate()
  const rows = useMemo(
    () =>
      POPULAR_ROUTES.map((r) => {
        const from = CAMPUS_LOCATIONS.find((l) => l.id === r.from)?.name ?? r.from
        const to = CAMPUS_LOCATIONS.find((l) => l.id === r.to)?.name ?? r.to
        return { ...r, from, to, fare: perSeatFare(r.from, r.to), km: distanceKm(r.from, r.to), mins: rideMinutes(r.from, r.to) }
      }),
    [],
  )

  return (
    <section id="fares" aria-labelledby="fares-heading" className="scroll-mt-16 border-y border-border bg-muted">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fare board</p>
          <h2 id="fares-heading" className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Six busy corridors.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            Same function as the booking card. Per-seat price, distance, and typical ride time.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-8">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div
              aria-hidden
              className="grid grid-cols-[1fr_auto] gap-4 border-b border-border px-5 py-3 font-mono text-xs uppercase tracking-widest text-muted-foreground sm:grid-cols-[1fr_110px_90px_110px]"
            >
              <span>Route</span>
              <span className="hidden text-right sm:block">Dist</span>
              <span className="hidden text-right sm:block">Time</span>
              <span className="text-right">Seat</span>
            </div>
            <ul>
              {rows.map((r, i) => (
                <motion.li
                  key={`${r.from}-${r.to}-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-32px' }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-muted sm:grid-cols-[1fr_110px_90px_110px]"
                >
                  <span className="min-w-0 text-[15px] font-semibold">
                    {r.from} <span aria-hidden className="mx-1 font-normal text-muted-foreground">→</span> {r.to}
                  </span>
                  <span className="hidden font-mono text-sm tabular-nums text-muted-foreground sm:block sm:text-right">
                    {r.km === null ? '—' : `${r.km.toFixed(1)} km`}
                  </span>
                  <span className="hidden font-mono text-sm tabular-nums text-muted-foreground sm:block sm:text-right">~{r.mins}m</span>
                  <span className="text-right font-mono text-[15px] font-bold tabular-nums">{formatCurrency(r.fare)}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </Reveal>

        <button
          type="button"
          onClick={() => navigate('/register/student')}
          className="btn-press mt-6 inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-6 py-3 text-[15px] font-bold text-primary-foreground"
        >
          Start a group ride
          <ArrowRight01Icon aria-hidden className="size-5" />
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Steps — ledger rows                                                 */
/* ------------------------------------------------------------------ */

function StepsSection() {
  const [tab, setTab] = useState<'rider' | 'driver'>('rider')

  const steps =
    tab === 'rider'
      ? [
          { n: '01', title: 'Pick two stops', text: 'Fixed list. No typed addresses, no wrong pins.' },
          { n: '02', title: 'Join four seats', text: 'Fare shown first. The keke leaves once all four fill.' },
          { n: '03', title: 'Ride the record', text: 'Driver, seats and route logged. Share it from Trips.' },
        ]
      : [
          { n: '01', title: 'Apply once', text: 'Student ID plus keke check. Then every corridor is open.' },
          { n: '02', title: 'Take fours', text: 'Requests queue by stop. Pick up, drop off, fares add per seat.' },
          { n: '03', title: 'Withdraw', text: 'Seat fares sit in your wallet. Bank payout on payout days.' },
        ]

  return (
    <section id="steps" aria-labelledby="steps-heading" className="scroll-mt-16">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Steps</p>
            <h2 id="steps-heading" className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Three moves.
            </h2>
          </Reveal>
          <div role="tablist" aria-label="Rider or driver steps" className="inline-flex self-start rounded-lg border border-border bg-muted p-1">
            {(['rider', 'driver'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'relative min-h-10 rounded-md px-5 py-2 text-sm font-bold capitalize transition-colors',
                  tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab === t && (
                  <motion.span
                    layoutId="steps-pill"
                    className="absolute inset-0 rounded-md bg-card shadow-sm ring-1 ring-border"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{t}</span>
              </button>
            ))}
          </div>
        </div>

        <ol className="mt-8 border-t border-border">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {steps.map((s) => (
                <li key={s.n} className="grid gap-1 border-b border-border py-5 sm:grid-cols-[64px_220px_1fr] sm:items-baseline sm:gap-4">
                  <span aria-hidden className="font-mono text-sm font-bold tabular-nums text-muted-foreground">
                    {s.n}
                  </span>
                  <h3 className="font-heading text-base font-bold tracking-tight">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </motion.div>
          </AnimatePresence>
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Earn — ledger + spring number                                       */
/* ------------------------------------------------------------------ */

function EarnSection() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState(6)
  const avgSeat = useMemo(() => perSeatFare('main-gate', 'hostelFemale'), [])
  const weekly = trips * 5 * avgSeat * 4
  const spring = useSpring(weekly, { stiffness: 120, damping: 20 })
  const reduce = useReducedMotion()

  useEffect(() => {
    spring.set(weekly)
  }, [weekly, spring])

  const weeklyText = useTransform(spring, (v) => formatCurrency(Math.round(v)))

  return (
    <section id="earn" aria-labelledby="earn-heading" className="scroll-mt-16 border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-start lg:px-8 lg:py-20">
        <Reveal>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Earn</p>
          <h2 id="earn-heading" className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Drive the line.
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
            Between lectures, carry verified students. Four fares per run, straight to your wallet.
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/register/driver')}
              className="btn-press inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-[15px] font-bold text-primary-foreground"
            >
              Apply as a driver
              <ArrowRight01Icon aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn-press inline-flex min-h-12 items-center justify-center rounded-lg border border-border px-6 py-3 text-[15px] font-semibold transition-colors hover:bg-muted"
            >
              Driver log in
            </button>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-7">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Weekly sketch</h3>
            <p className="mt-3 font-mono text-4xl font-bold tabular-nums tracking-tight">
              {reduce ? formatCurrency(weekly) : <motion.span>{weeklyText}</motion.span>}
            </p>
            <p className="mt-1 font-mono text-[13px] tabular-nums text-muted-foreground">
              {trips} trips/d · 5d · 4 × {formatCurrency(avgSeat)}
            </p>
            <label htmlFor="trips" className="mt-6 block text-sm font-semibold">
              Trips per day: <output htmlFor="trips">{trips}</output>
            </label>
            <input
              id="trips"
              type="range"
              min={2}
              max={12}
              step={1}
              value={trips}
              onChange={(e) => setTrips(Number(e.target.value))}
              className="mt-3 w-full accent-primary"
              aria-describedby="earn-note"
            />
            <div aria-hidden className="flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
              <span>2</span>
              <span>12</span>
            </div>
            <p id="earn-note" className="mt-4 rounded-lg bg-muted px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
              Sketch only — real earnings follow your routes. The split is shown in the driver app before you accept.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16 border-t border-border bg-muted">
      <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
        <Reveal className="text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">FAQ</p>
          <h2 id="faq-heading" className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Asked on the line.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            Upfront fares, groups of four, campus stops only.
          </p>
        </Reveal>
        <Reveal delay={0.08} className="mt-8">
          <Accordion type="single" collapsible defaultValue="item-0" className="space-y-2.5">
            {FAQS.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="overflow-hidden rounded-lg border border-border bg-card px-5 shadow-sm"
              >
                <AccordionTrigger className="py-4 text-left text-[15px] font-bold">{f.q}</AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Close band                                                          */
/* ------------------------------------------------------------------ */

function CloseBand() {
  const navigate = useNavigate()

  return (
    <section aria-labelledby="cta-heading" className="bg-muted pb-14 lg:pb-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="rounded-xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12 lg:py-14">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest opacity-70">
              {CAMPUS_LOCATIONS.length} stops · groups of 4 · upfront fares
            </p>
            <h2 id="cta-heading" className="mx-auto mt-3 max-w-xl text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Your seat is on the line.
            </h2>
            <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/register/student')}
                className="btn-press inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-background px-7 py-3 text-base font-bold text-foreground"
              >
                Find a seat
                <ArrowRight01Icon aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/register/driver')}
                className="btn-press inline-flex min-h-12 items-center justify-center rounded-lg border border-primary-foreground/30 px-7 py-3 text-base font-semibold transition-colors hover:bg-primary-foreground/10"
              >
                Become a driver
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function FooterSection() {
  const year = new Date().getFullYear()
  const scrollTo = (id: string) => scrollToSection(id)

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <span className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/15">
                <RMark className="text-lg" />
              </span>
              <span className="font-heading text-lg font-bold tracking-tight">
                Ryde<span className="text-primary">pus</span>
              </span>
            </span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Fixed stops, per-seat fares, groups of four. Campus only.
            </p>
            <p className="mt-4 font-mono text-xs tabular-nums text-muted-foreground">{CAMPUS_LOCATIONS.length} stops · 4 seats · upfront fares</p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-14">
            <div>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ride</h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <button type="button" onClick={() => scrollTo('book')} className="text-muted-foreground transition-colors hover:text-foreground">
                    Book a seat
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollTo('fares')} className="text-muted-foreground transition-colors hover:text-foreground">
                    Fare board
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Drive</h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <Link to="/register/driver" className="text-muted-foreground transition-colors hover:text-foreground">
                    Become a driver
                  </Link>
                </li>
                <li>
                  <button type="button" onClick={() => scrollTo('earn')} className="text-muted-foreground transition-colors hover:text-foreground">
                    Earnings sketch
                  </button>
                </li>
                <li>
                  <Link to="/login" className="text-muted-foreground transition-colors hover:text-foreground">
                    Log in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Line</h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <button type="button" onClick={() => scrollTo('steps')} className="text-muted-foreground transition-colors hover:text-foreground">
                    Steps
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => scrollTo('faq')} className="text-muted-foreground transition-colors hover:text-foreground">
                    FAQ
                  </button>
                </li>
                <li>
                  <a href="mailto:hello@rydepus.app" className="text-muted-foreground transition-colors hover:text-foreground">
                    hello@rydepus.app
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="font-mono text-xs tabular-nums text-muted-foreground">© {year} Rydepus · campus line</p>
          <p className="font-mono text-xs text-muted-foreground">stop → stop · 4 seats · no detours</p>
        </div>
      </div>
    </footer>
  )
}
