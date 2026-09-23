import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, FileCheck2, UploadCloud } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { homePathForRole } from '../../utils/routing'
import { AuthLayout } from './AuthLayout'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { DarkField } from '../../components/ui/DarkField'
import { Logo } from '../../components/ui/Logo'
import { driverApplicationService } from '../../services/driverApplicationService'
import { GoogleIcon, deriveName, fetchGoogleAccount, initials } from './sharedAuth'
import { cn } from '../../utils/cn'

type Step = 'email' | 'profile' | 'verifying'

interface DrivingDetails {
  phone: string
  plateNumber: string
  licenseFile: string | null
}

type FieldErrors = Partial<Record<'fullName' | 'email' | 'phone' | 'plateNumber' | 'licenseFile', string>>

export function DriverRegister() {
  const { register, status } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [details, setDetails] = useState<DrivingDetails>({ phone: '', plateNumber: '', licenseFile: null })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const name = fullName.trim()
  const nameInitials = useMemo(() => initials(name || 'D R'), [name])

  // Redirect if already authenticated and not on the verifying screen.
  useEffect(() => {
    if (status === 'authenticated' && step !== 'verifying') {
      navigate(homePathForRole(authService.getRole()), { replace: true })
    }
  }, [status, step, navigate])

  // ----- Email / Google step ------------------------------------------------

  const handleNext = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setErrors((p) => ({ ...p, email: 'Enter your email address.' }))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrors((p) => ({ ...p, email: 'Enter a valid email address.' }))
      return
    }
    setErrors((p) => ({ ...p, email: undefined }))
    setFullName((prev) => prev.trim() || deriveName(trimmed))
    setStep('profile')
  }

  /** Simulate a Google OAuth round-trip that returns the linked identity. */
  const handleGoogle = async () => {
    setGoogleBusy(true)
    setErrors((p) => ({ ...p, email: undefined }))
    try {
      const account = await fetchGoogleAccount(email)
      setFullName((prev) => prev.trim() || account.fullName)
      setEmail(account.email)
      setStep('profile')
    } finally {
      setGoogleBusy(false)
    }
  }

  // ----- Driver details step ------------------------------------------------

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setDetails((p) => ({ ...p, licenseFile: file.name }))
    setErrors((p) => ({ ...p, licenseFile: undefined }))
  }

  const validateProfile = (): boolean => {
    const emailValue = email.trim()
    const phoneDigits = details.phone.replace(/\D/g, '')
    const next: FieldErrors = {}
    if (!fullName.trim()) next.fullName = 'Enter your full name.'
    if (!emailValue) next.email = 'Enter your email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) next.email = 'Enter a valid email address.'
    if (!details.phone.trim()) next.phone = 'Enter your phone number.'
    else if (!/^0[0-9]{10}$/.test(phoneDigits)) next.phone = 'Enter a valid 11-digit phone number (e.g. 08012345678).'
    if (!details.plateNumber.trim()) next.plateNumber = 'Enter your vehicle plate number.'
    else if (!/^[A-Za-z]{1,3}[-\s]?\d{1,6}[-\s]?[A-Za-z]{0,3}$/.test(details.plateNumber.trim())) {
      next.plateNumber = 'Plate looks invalid (e.g. EPE-789XY).'
    }
    if (!details.licenseFile) next.licenseFile = 'Upload your permit or license.'
    setErrors(next)
    return !next.fullName && !next.email && !next.phone && !next.plateNumber && !next.licenseFile
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateProfile()) return

    setBusy(true)
    setFormError(null)
    setStep('verifying')
    try {
      // Persist a session so the demo can continue into the app, and record the application.
      await register({ fullName: fullName.trim(), email: email.trim(), phone: details.phone.replace(/\D/g, '') }, 'driver')
      await driverApplicationService.submit({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: details.phone,
        plateNumber: details.plateNumber,
        licenseFile: details.licenseFile,
      })
    } catch {
      setFormError('We could not verify your driver credentials. Please try again.')
      setStep('profile')
      setBusy(false)
    }
  }

  // ------- Step 1 · email / Google -------
  const IdentityStep = (
    <div key="email" className="animate-ryde-step flex flex-col">
      <div className="mb-4 inline-flex w-fit items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400">
        Join as Driver · 1 of 2
      </div>
      <h1 className="text-[26px] font-bold tracking-tight text-white">Join Rydepus as Driver</h1>
      <p className="mt-1.5 text-sm text-ink-400">Create your account to get started.</p>

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
            placeholder="driver@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }))
            }}
            error={errors.email}
          />
          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={googleBusy || busy || !email.trim()}
            className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-base font-semibold shadow-sm hover:from-brand-400 hover:to-brand-500 disabled:from-brand-600/40 disabled:to-brand-600/40 disabled:text-white/60"
          >
            Next
          </Button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-ink-400">
        <Link to="/register" className="font-semibold text-brand-400 hover:underline">
          ← Choose a different role
        </Link>
      </p>
    </div>
  )

  // ------- Step 2 · driver verification -------
  const DetailsStep = (
    <div key="profile" className="animate-ryde-step flex flex-col">
      <div className="mb-4 inline-flex w-fit items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400">
        Join as Driver · 2 of 2
      </div>
      <h1 className="text-[26px] font-bold tracking-tight text-white">Driver Verification</h1>
      <p className="mt-1.5 text-sm text-ink-400">Provide details to operate on campus.</p>

      <div className="mt-6 flex flex-col items-center">
        <div className="relative">
          <div className="flex size-16 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white ring-1 ring-white/10">
            {nameInitials}
          </div>
          <span className="absolute -right-0.5 bottom-0 flex size-6 items-center justify-center rounded-full bg-brand-500 text-white ring-4 ring-white/10">
            <Camera className="size-3" />
          </span>
        </div>
      </div>

      <form onSubmit={handleRegister} className="mt-6 space-y-4" noValidate>
        <DarkField
          label="Full name"
          autoComplete="name"
          placeholder="e.g. Musa Ibrahim"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value)
            if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined }))
          }}
          error={errors.fullName}
        />
        <DarkField
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="08012345678"
          value={details.phone}
          onChange={(e) => {
            setDetails((p) => ({ ...p, phone: e.target.value }))
            if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }))
          }}
          error={errors.phone}
        />
        <DarkField
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="driver@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (errors.email) setErrors((p) => ({ ...p, email: undefined }))
          }}
          error={errors.email}
        />
        <DarkField
          label="Plate number"
          placeholder="EPE-789XY"
          value={details.plateNumber}
          onChange={(e) => {
            setDetails((p) => ({ ...p, plateNumber: e.target.value }))
            if (errors.plateNumber) setErrors((p) => ({ ...p, plateNumber: undefined }))
          }}
          error={errors.plateNumber}
        />

        <div className="w-full">
          <label className="mb-1.5 block text-[13px] font-medium text-ink-300">
            Vehicle permit / license
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 transition',
              details.licenseFile
                ? 'border-brand-400/50 bg-brand-400/10'
                : errors.licenseFile
                  ? 'border-rose-400/60 bg-rose-500/10'
                  : 'border-white/15 bg-white/[0.04] hover:border-brand-400/50 hover:bg-white/[0.06]',
            )}
          >
            {details.licenseFile ? (
              <>
                <FileCheck2 aria-hidden className="size-6 text-brand-400" />
                <span className="mx-auto max-w-full truncate text-sm font-medium text-brand-300">
                  {details.licenseFile}
                </span>
                <span className="text-xs text-ink-500">Epe campus zone verification</span>
              </>
            ) : (
              <>
                <UploadCloud aria-hidden className="size-6 text-ink-400" />
                <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/15">
                  Upload File
                </span>
                <span className="text-xs text-ink-500">Permit/license for Epe campus zone · PDF, JPG or PNG</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {errors.licenseFile && (
            <p role="alert" className="mt-1.5 text-sm text-rose-400">
              {errors.licenseFile}
            </p>
          )}
        </div>

        {formError && <Alert tone="error-dark">{formError}</Alert>}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={busy}
          className="mt-2 h-14 rounded-full bg-brand-500 text-base font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
        >
          {busy ? 'Submitting…' : 'Register as Driver'}
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
      <Logo tone="dark" className="animate-pulse" />
      <h2 className="mt-10 text-2xl font-bold tracking-tight text-white">
        Verifying Driver Credentials…
      </h2>
      <p className="mt-2 max-w-[260px] text-sm text-ink-400">This might take a moment.</p>
      <span className="mt-8 size-9 animate-spin rounded-full border-[3px] border-white/20 border-t-brand-500" />
    </div>
  )

  return (
    <AuthLayout>
      {step === 'email' && IdentityStep}
      {step === 'profile' && DetailsStep}
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