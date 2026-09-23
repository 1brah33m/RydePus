import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services/authService'
import { DEMO_ACCOUNT } from '../mock/data'
import { homePathForRole } from '../utils/routing'
import { Logo } from '../components/ui/Logo'
import { KekeIllustration } from '../components/splash/KekeIllustration'

export function Onboarding() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [guestBusy, setGuestBusy] = useState(false)

  const continueAsGuest = async () => {
    setGuestBusy(true)
    try {
      await login(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password)
      navigate(homePathForRole(authService.getRole()), { replace: true })
    } catch {
      setGuestBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-charcoal text-white">
      {/* soft top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(75% 42% at 50% -8%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 60%)',
        }}
      />

      <header className="relative z-10 flex justify-between px-6 pt-6">
        <Logo tone="dark" />
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-between px-6 pb-8">
        {/* Graphic */}
        <div className="mt-2 flex justify-center">
          <div className="animate-ryde-float w-full max-w-[300px]">
            <KekeIllustration />
          </div>
        </div>

        {/* Copy + CTAs */}
        <div className="mt-8 flex flex-col items-center text-center">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            Your Campus Ride,
            <br />
            Elevated.
          </h1>
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-ink-300">
            Fast, reliable, and safe Keke sharing exclusively for students.
          </p>

          <div className="mt-8 w-full max-w-xs space-y-3">
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-bold text-ink-900 shadow-lg shadow-black/30 transition-transform active:scale-[0.98]"
            >
              Create Account
              <ArrowRight aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex h-14 w-full items-center justify-center rounded-full border border-white/25 text-base font-bold text-white transition-colors hover:bg-white/10 active:bg-white/15"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={continueAsGuest}
              disabled={guestBusy}
              className="mx-auto block text-sm font-medium text-ink-400 underline-offset-4 transition-colors hover:text-white disabled:opacity-60"
            >
              {guestBusy ? 'Taking you in…' : 'Continue as guest'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}