import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import type { RegisterPayload } from '../../types'
import { homePathForRole } from '../../utils/routing'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { DarkField, DarkSelect } from '../../components/ui/DarkField'
import { AuthLayout } from './AuthLayout'
import { GoogleIcon, deriveName, fetchGoogleAccount, initials } from './sharedAuth'

const LEVELS = [100, 200, 300, 400, 500, 600, 700].map((n) => ({
  value: String(n),
  label: `${n}L`,
}))

const FACULTIES = [
  'Faculty of Engineering',
  'Faculty of Science',
  'Faculty of Management Sciences',
  'Faculty of Arts',
  'Faculty of Education',
  'Faculty of Law',
  'Faculty of Social Sciences',
  'Faculty of Environmental Sciences',
  'Faculty of Medicine',
  'Faculty of Agriculture',
].map((f) => ({ value: f, label: f }))

type Step = 'email' | 'profile' | 'verifying'

type FieldErrors = Partial<Record<'fullName' | 'email' | 'phone' | 'faculty' | 'department' | 'level', string>>

export function Register() {
  const { register, status } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [form, setForm] = useState<RegisterPayload>({ fullName: '', email: '' })
  const [errors, setErrors] = useState<FieldErrors & { matricNumber?: string }>({})
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const name = form.fullName?.trim() ?? ''
  const nameInitials = useMemo(() => initials(name || 'S T'), [name])

  // Redirect if already authenticated and not on the verifying screen.
  useEffect(() => {
    if (status === 'authenticated' && step !== 'verifying') {
      navigate(homePathForRole(authService.getRole()), { replace: true })
    }
  }, [status, step, navigate])

  // ----- Email / Google step ------------------------------------------------

  /** Manual entry: derive the name from the typed email, then move to profile. */
  const handleNext = (e: FormEvent) => {
    e.preventDefault()
    const email = form.email?.trim() ?? ''
    if (!email) {
      setErrors((p) => ({ ...p, email: 'Enter your email address.' }))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors((p) => ({ ...p, email: 'Enter a valid email address.' }))
      return
    }
    setErrors((p) => ({ ...p, email: undefined }))
    setForm((p) => ({ ...p, email, fullName: p.fullName?.trim() || deriveName(email) }))
    setStep('profile')
  }

  /** Simulate a Google OAuth round-trip that returns the linked identity. */
  const handleGoogle = async () => {
    setGoogleBusy(true)
    setErrors((p) => ({ ...p, email: undefined }))
    try {
      const account = await fetchGoogleAccount(form.email)
      setForm((p) => ({
        ...p,
        fullName: p.fullName?.trim() || account.fullName,
        email: account.email,
      }))
      setStep('profile')
    } finally {
      setGoogleBusy(false)
    }
  }

  // ----- Profile step -------------------------------------------------------

  const validateProfile = (): boolean => {
    const email = form.email?.trim() ?? ''
    const phoneDigits = (form.phone ?? '').replace(/\D/g, '')
    const next: FieldErrors = {}
    if (!form.fullName?.trim()) next.fullName = 'Enter your full name.'
    if (!email) next.email = 'Enter your campus email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.'
    if (!form.phone?.trim()) next.phone = 'Enter your phone number.'
    else if (!/^0[0-9]{10}$/.test(phoneDigits)) {
      next.phone = 'Enter a valid 11-digit phone number (e.g. 08123456789).'
    }
    if (!form.faculty?.trim()) next.faculty = 'Select your faculty.'
    if (!form.department?.trim()) next.department = 'Enter your department.'
    if (!form.level) next.level = 'Select your current level.'
    setErrors(next)
    return !next.fullName && !next.email && !next.phone && !next.faculty && !next.department && !next.level
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateProfile()) return
    setBusy(true)
    setFormError(null)
    setStep('verifying')
    try {
      await register({
        ...form,
        fullName: form.fullName!.trim(),
        email: form.email!.trim().toLowerCase(),
        phone: (form.phone ?? '').replace(/\D/g, ''),
      })
    } catch {
      setFormError('We could not verify your student account. Please try again.')
      setStep('profile')
      setBusy(false)
    }
  }

  const setField = (field: keyof RegisterPayload, value: string) => {
    setForm((p) => ({ ...p, [field]: value }))
    if (errors[field as keyof typeof errors]) setErrors((p) => ({ ...p, [field]: undefined }))
  }

  // ------- Step 1 · email / Google -------
  const EmailStep = (
    <div key="email" className="animate-keke-step flex flex-col">
      <div className="mb-4 inline-flex w-fit items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400">
        Join as Student · 1 of 2
      </div>
      <h1 className="text-[26px] font-bold tracking-tight text-white">Join KekeGo as Student</h1>
      <p className="mt-1.5 text-sm text-ink-400">Ride with your classmates, split the fare, get there together.</p>

      <div className="mt-7">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleBusy || busy}
          className="flex h-13 w-full items-center justify-center gap-3 rounded-full bg-white text-sm font-semibold text-ink-900 transition hover:bg-gray-100 active:scale-[0.99] disabled:opacity-60"
        >
          {googleBusy ? <Spinner size="sm" className="text-ink-400" /> : <GoogleIcon />}
          {googleBusy ? 'Connecting to Google…' : 'Continue with Google'}
        </button>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium uppercase tracking-wider text-ink-500">or</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleNext} className="space-y-4" noValidate>
          <DarkField
            label="Email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@campus.edu.ng"
            value={form.email ?? ''}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
          />
          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={googleBusy || busy || !(form.email ?? '').trim()}
            className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-base font-semibold shadow-sm hover:from-brand-400 hover:to-brand-500 disabled:from-brand-600/40 disabled:to-brand-600/40 disabled:text-white/60"
          >
            Next
          </Button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-ink-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-400 hover:underline">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink-400">
        <Link to="/register" className="font-semibold text-brand-400 hover:underline">
          ← Choose a different role
        </Link>
      </p>
    </div>
  )

  // ------- Step 2 · student profile -------
  const ProfileStep = (
    <div key="profile" className="animate-keke-step flex flex-col">
      <div className="mb-4 inline-flex w-fit items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400">
        Join as Student · 2 of 2
      </div>
      <h1 className="text-[26px] font-bold tracking-tight text-white">Student Details</h1>
      <p className="mt-1.5 text-sm text-ink-400">Tell us about you to verify your student status.</p>

      <div className="mt-6 flex flex-col items-center">
        <div className="relative">
          <div className="flex size-16 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white ring-1 ring-white/10">
            {nameInitials}
          </div>
          <span className="absolute -right-0.5 bottom-0 flex size-6 items-center justify-center rounded-full bg-brand-500 text-white ring-4 ring-charcoal">
            <Camera className="size-3" />
          </span>
        </div>
      </div>

      <form onSubmit={handleCreate} className="mt-6 space-y-4" noValidate>
        <DarkField
          label="Full name"
          autoComplete="name"
          placeholder="e.g. Aisha Bello"
          value={form.fullName ?? ''}
          onChange={(e) => setField('fullName', e.target.value)}
          error={errors.fullName}
        />
        <DarkField
          label="Campus email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@campus.edu.ng"
          value={form.email ?? ''}
          onChange={(e) => setField('email', e.target.value)}
          error={errors.email}
        />
        <DarkField
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="08012345678"
          value={form.phone ?? ''}
          onChange={(e) => setField('phone', e.target.value)}
          error={errors.phone}
        />
        <DarkSelect
          label="Faculty"
          options={FACULTIES}
          placeholder="Select faculty"
          value={form.faculty ?? ''}
          onChange={(e) => setField('faculty', e.target.value)}
          error={errors.faculty}
        />
        <DarkField
          label="Department"
          placeholder="e.g. Computer Engineering"
          value={form.department ?? ''}
          onChange={(e) => setField('department', e.target.value)}
          error={errors.department}
        />
        <div className="grid grid-cols-2 gap-3">
          <DarkSelect
            label="Level"
            options={LEVELS}
            placeholder="e.g. 400L"
            value={form.level ?? ''}
            onChange={(e) => setField('level', e.target.value)}
            error={errors.level}
          />
          <DarkField
            label="Matric number"
            placeholder="CU2021/34567"
            value={form.matricNumber ?? ''}
            onChange={(e) => setField('matricNumber', e.target.value)}
            error={errors.matricNumber}
          />
        </div>

        {formError && <Alert tone="error-dark">{formError}</Alert>}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={busy}
          className="mt-2 h-14 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-base font-semibold shadow-sm hover:from-brand-400 hover:to-brand-500"
        >
          {busy ? 'Creating account…' : 'Create Student Account'}
        </Button>
        <button
          type="button"
          onClick={() => {
            if (!busy) setStep('email')
          }}
          className="mx-auto block text-sm text-ink-400 transition hover:text-white"
        >
          ← Back
        </button>
      </form>
    </div>
  )

  // ------- Step 3 · verifying -------
  const VerifyingStep = (
    <div key="verifying" className="animate-keke-step flex flex-col items-center pt-14 text-center">
      <VerifyingTimer navigate={navigate} />
      <div className="relative mb-10 h-20 w-40">
        <div className="absolute inset-0 rounded-full bg-brand-500/25 blur-2xl animate-pulse" />
        <div className="relative flex items-center justify-center pt-2">
          <span className="flex size-16 items-center justify-center rounded-full bg-brand-500 shadow-[0_0_40px_rgba(0,230,118,0.5)]">
            <span className="text-[28px] font-bold leading-none text-charcoal">K</span>
          </span>
          <span className="-ml-1 text-[32px] font-light leading-none text-charcoal">o</span>
        </div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-white">Verifying Student Status…</h2>
      <p className="mt-2 max-w-[260px] text-sm text-ink-400">This might take a moment.</p>
      <span className="mt-8 size-9 animate-spin rounded-full border-[3px] border-white/20 border-t-brand-500" />
    </div>
  )

  return (
    <AuthLayout>
      {step === 'email' && EmailStep}
      {step === 'profile' && ProfileStep}
      {step === 'verifying' && VerifyingStep}
    </AuthLayout>
  )
}

// Separate component so the timer hook runs only when mounted
function VerifyingTimer({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  useEffect(() => {
    const t = setTimeout(() => navigate(homePathForRole(authService.getRole()), { replace: true }), 2400)
    return () => clearTimeout(t)
  }, [navigate])
  return null
}