import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Briefcase,
  Camera,
  CircleUserRound,
  Menu,
  MessageCircle,
  Send,
  ShieldCheck,
  Star,
  UserRound,
  X,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { RMark } from '../../components/ui/Logo'

/** Hardcoded campus landmarks used in the booking card dropdowns. */
const LANDMARKS = [
  'Main Gate',
  'School of Agriculture',
  'ECE department',
  'Hostel Area(Female)',
  'Hostel Area(Male)',
  'Faculty of Environmental Sciences',
  'Staff Club',
  'Main University Mosque',
  'CHE Department',
  'Lecture Theatre Hall',
]

/** Top-level marketing navigation; page nodes scroll, route nodes navigate. */
const NAV_LINKS: { label: string; id?: string; to?: string }[] = [
  { label: 'Home', id: 'home' },
  { label: 'Book a Ride', id: 'book' },
  { label: 'Become a Driver', to: '/register/driver' },
  { label: 'About Us', id: 'features' },
]

/**
 * Public marketing landing page (Uber-inspired, yellow + black palette).
 * Rendered for logged-out visitors at "/". All CTAs feed into the existing
 * auth flows: register, driver register, and login.
 */
export function LandingPage() {
  return (
    <div className="min-h-full bg-ink-50 text-ink-900">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <FooterSection />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Navbar                                                              */
/* ------------------------------------------------------------------ */

function Navbar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const scrollTo = (id: string) => {
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleNav = (item: (typeof NAV_LINKS)[number]) => {
    if (item.to) {
      setOpen(false)
      navigate(item.to)
    } else if (item.id) {
      scrollTo(item.id)
    }
  }

  return (
    <nav className="sticky top-0 z-30 bg-charcoal/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => scrollTo('home')} className="flex items-center gap-2" aria-label="Rydepus home">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-500/25">
            <RMark tone="dark" className="text-lg" />
          </span>
          <span className="flex flex-col text-lg font-extrabold leading-[1.1] tracking-tight text-white">
            <span>Ryde</span>
            <span className="text-brand-400">pus</span>
          </span>
        </button>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleNav(item)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate('/login')}
            aria-label="Profile"
            className="ml-2 flex size-10 items-center justify-center rounded-xl text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            <CircleUserRound aria-hidden className="size-6" />
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex size-10 items-center justify-center rounded-xl text-white md:hidden"
        >
          {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
        </button>
      </div>

      {/* Mobile links */}
      {open && (
        <div className="border-t border-white/10 bg-charcoal px-4 pb-4 pt-2 sm:px-6 md:hidden">
          {NAV_LINKS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleNav(item)}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </button>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-ink-900"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              Sign Up
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* Hero: split layout with booking card on the right                   */
/* ------------------------------------------------------------------ */

function HeroSection() {
  return (
    <section id="home" className="relative scroll-mt-16 overflow-hidden bg-charcoal text-white">
      {/* Soft ambient glow — a subtle highlight, not a busy pattern. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 70% -10%, rgba(113,162,244,0.18) 0%, rgba(113,162,244,0) 60%)',
        }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8 lg:pb-20 lg:pt-16">
        {/* Left: headline, subheadline, hero image */}
        <div className="flex flex-col">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85">
            <ShieldCheck aria-hidden className="size-3.5 text-brand-400" />
            Safe · Fast · Student-only rides
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Campus Mobility,
            <br />
            <span className="text-brand-400">Elevated.</span>
          </h1>

          <p className="mt-4 max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
            Your everyday campus ride, now easier than ever. Sign up to ride.
          </p>
        </div>

        {/* Right: interactive booking card */}
        <div className="lg:justify-self-end" id="book">
          <BookingCard />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Booking card: functional Ride / Drive tab switch                    */
/* ------------------------------------------------------------------ */

type LandingTab = 'ride' | 'drive'

function BookingCard() {
  // Active tab drives which panel renders below the header.
  const [tab, setTab] = useState<LandingTab>('ride')
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const navigate = useNavigate()

  return (
    <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white text-ink-900 shadow-2xl shadow-black/40">
      {/* Tab bar */}
      <div className="flex border-b border-ink-100" role="tablist" aria-label="Ride or drive">
        {(['ride', 'drive'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'relative flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors',
              tab === t ? 'text-ink-900' : 'text-ink-400 hover:text-ink-600',
            )}
          >
            {t}
            {tab === t && <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-brand-500" />}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-6">
        {tab === 'ride' ? (
          /* ---------- Ride tab: pickup + destination + request ---------- */
          <div role="tabpanel">
            <label htmlFor="pickup" className="block text-xs font-semibold uppercase tracking-wide text-ink-500">
              Pickup location
            </label>
            <select
              id="pickup"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              className={cn(
                'mt-1.5 w-full rounded-2xl border bg-ink-50 px-4 py-3 text-sm outline-none transition-colors focus:border-charcoal',
                pickup ? 'border-ink-200 text-ink-900' : 'border-ink-200 text-ink-400',
              )}
            >
              <option value="">Select pickup</option>
              {LANDMARKS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <label htmlFor="destination" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-ink-500">
              Enter destination
            </label>
            <select
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className={cn(
                'mt-1.5 w-full rounded-2xl border bg-ink-50 px-4 py-3 text-sm outline-none transition-colors focus:border-charcoal',
                destination ? 'border-ink-200 text-ink-900' : 'border-ink-200 text-ink-400',
              )}
            >
              <option value="">Select destination</option>
              {LANDMARKS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => navigate('/register/student')}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4 text-base font-bold text-white transition-colors hover:bg-brand-700 active:scale-[0.98]"
            >
              Request Rydepus
              <ArrowRight aria-hidden className="size-5" />
            </button>
          </div>
        ) : (
          /* ---------- Drive tab: driver pitch + CTAs ---------- */
          <div role="tabpanel">
            <h2 className="text-xl font-extrabold tracking-tight text-ink-900">Turn Your Keke Into Income.</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Drive your fellow students, set your own hours, and get paid securely.
            </p>

            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => navigate('/register/driver')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4 text-base font-bold text-white transition-colors hover:bg-brand-700 active:scale-[0.98]"
              >
                Apply as a Driver
                <ArrowRight aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full rounded-2xl border-2 border-charcoal py-4 text-base font-bold text-charcoal transition-colors hover:bg-charcoal hover:text-white active:scale-[0.98]"
              >
                Driver Log In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Features: 4-card responsive grid                                    */
/* ------------------------------------------------------------------ */

function FeaturesSection() {
  const navigate = useNavigate()

  return (
    <section id="features" className="scroll-mt-16 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Campus Safety */}
          <div className="flex h-full flex-col rounded-3xl border border-ink-200 bg-white p-6">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-charcoal text-brand-400">
              <ShieldCheck aria-hidden className="size-6" />
            </span>
            <h3 className="mt-4 text-base font-bold tracking-tight text-ink-900">Campus Safety</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              Campus Safety uses the campus-wide ride network. Your safe journey starts now.
            </p>
          </div>

          {/* Driver Spotlight */}
          <div className="flex h-full flex-col rounded-3xl border border-ink-200 bg-white p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 ring-2 ring-white">
              <UserRound aria-hidden className="size-6 text-ink-900" />
            </span>
            <h3 className="mt-4 text-base font-bold tracking-tight text-ink-900">Driver Spotlight</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              Keke driver on Campus. Spotlight on top performers.
            </p>
          </div>

          {/* Earn with Rydepus — highlighted CTA card */}
          <button
            type="button"
            onClick={() => navigate('/register/driver')}
className="group flex h-full flex-col items-start rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 p-6 text-left transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-charcoal text-brand-300">
              <Star aria-hidden className="size-6" />
            </span>
            <h3 className="mt-4 text-base font-bold tracking-tight text-white">Earn with Rydepus</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/80">
              Pick your hours, drive your own keke, and turn spare time into income.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white underline-offset-4 group-hover:underline">
              Start earning
              <ArrowRight aria-hidden className="size-4" />
            </span>
          </button>

          {/* Safety with Rydepus — highlighted CTA card */}
          <button
            type="button"
            onClick={() => navigate('/register/student')}
            className="group flex h-full flex-col items-start rounded-3xl bg-charcoal p-6 text-left transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <ShieldCheck aria-hidden className="size-6" />
            </span>
            <h3 className="mt-4 text-base font-bold tracking-tight text-white">Safety with Rydepus</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/65">
              Every ride logs a verified driver and a tracked campus route.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-400 underline-offset-4 group-hover:underline">
              Ride safely
              <ArrowRight aria-hidden className="size-4" />
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Footer: links + social icons                                        */
/* ------------------------------------------------------------------ */

/** Social links — generic icons since this lucide version drops brand glyphs. */
const SOCIALS = [
  { label: 'Instagram', icon: Camera },
  { label: 'Twitter', icon: Send },
  { label: 'Facebook', icon: MessageCircle },
  { label: 'LinkedIn', icon: Briefcase },
]

function FooterSection() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-charcoal text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div>
            <span className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-500/25">
                <RMark tone="dark" className="text-lg" />
              </span>
              <span className="flex flex-col text-lg font-extrabold leading-[1.1] tracking-tight">
                <span>Ryde</span>
                <span className="text-brand-400">pus</span>
              </span>
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
              Campus mobility for students, by students. Safe, fast, and always a keke away.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-14">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">Product</h4>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-white/80 transition-colors hover:text-brand-400"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-white/80 transition-colors hover:text-brand-400"
                  >
                    Book a Ride
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">Drivers</h4>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <Link to="/register/driver" className="text-white/80 transition-colors hover:text-brand-400">
                    Become a Driver
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="text-white/80 transition-colors hover:text-brand-400">
                    Driver Log In
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">Company</h4>
              <ul className="mt-3 space-y-2.5 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-white/80 transition-colors hover:text-brand-400"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <a href="mailto:hello@rydepus.app" className="text-white/80 transition-colors hover:text-brand-400">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-5 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-white/40">© {year} Rydepus · Campus Mobility</p>
          <div className="flex gap-2.5">
            {SOCIALS.map(({ label, icon: Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                onClick={(e) => e.preventDefault()}
                className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-white/75 transition-colors hover:bg-white/10 hover:text-brand-400"
              >
                <Icon aria-hidden className="size-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}