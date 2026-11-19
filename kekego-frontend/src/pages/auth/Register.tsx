import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { isGoogleSignInConfigured, requestGoogleIdToken } from '../../services/googleAuth'
import type { RegisterPayload } from '../../types'
import { homePathForRole } from '../../utils/routing'
import { validatePassword } from '../../config/password'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { DarkField } from '../../components/ui/DarkField'
import { AuthSplitLayout } from '../../components/ui/AuthSplitLayout'
import { GoogleIcon, NameAndPasswordFields } from './sharedAuth'

type Step = 'form' | 'verifying'

const EMPTY_FORM: RegisterPayload = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

type FieldErrors = Partial<
  Record<
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'password'
    | 'confirmation',
    string
  >
>

export function Register() {
  const { register, status } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('form')
  const [form, setForm] = useState<RegisterPayload>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  /** True when the name/email came from a verified Google token. */
  const googleLinked = Boolean(form.googleIdToken)
  const googleAvailable = isGoogleSignInConfigured()

  // Redirect if already authenticated and not on the verifying screen.
  useEffect(() => {
    if (status === 'authenticated' && step !== 'verifying') {
      navigate(homePathForRole(authService.getRole()), { replace: true })
    }
  }, [status, step, navigate])

  /**
   * Real Google sign-in. The ID token is verified by the backend, which replies
   * with the first/last name we are allowed to prefill from the Google profile.
   * The identity is merged into the single form in place.
   */
  const handleGoogle = async () => {
    setGoogleBusy(true)
    setFormError(null)
    setErrors((p) => ({ ...p, email: undefined }))
    try {
      const idToken = await requestGoogleIdToken()
      const identity = await authService.resolveGoogleIdentity(idToken)
      setForm((p) => ({
        ...p,
        firstName: identity.first_name,
        lastName: identity.last_name,
        email: identity.email,
        googleIdToken: idToken,
      }))
    } catch (err) {
      setFormError(err instanceof Error && err.message ? err.message : 'Google sign-in failed. Try again.')
    } finally {
      setGoogleBusy(false)
    }
  }

  // ----- Validation ---------------------------------------------------------

  const validateForm = (): boolean => {
    const email = form.email?.trim() ?? ''
    const phoneDigits = (form.phone ?? '').replace(/\D/g, '')
    const next: FieldErrors = {}
    if (!form.firstName?.trim()) next.firstName = 'Enter your first name.'
    if (!form.lastName?.trim()) {
      next.lastName = googleLinked
        ? 'Your Google account has no last name. Use "use a different name" to add one.'
        : 'Enter your last name.'
    }
    if (!email) next.email = 'Enter your campus email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.'
    if (!form.phone?.trim()) next.phone = 'Enter your phone number.'
    else if (!/^0[0-9]{10}$/.test(phoneDigits)) {
      next.phone = 'Enter a valid 11-digit phone number (e.g. 08123456789).'
    }
    const passwordError = validatePassword(form.password)
    if (passwordError) next.password = passwordError
    setErrors(next)
    return Object.values(next).every((message) => !message)
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setBusy(true)
    setFormError(null)
    setStep('verifying')
    try {
      await register({
        ...form,
        // The confirm-password field was removed from the student form, but the
        // backend still requires a matching `confirm_password`: mirror it.
        confirmPassword: form.password,
        firstName: form.firstName!.trim(),
        lastName: form.lastName!.trim(),
        email: form.email!.trim().toLowerCase(),
        phone: (form.phone ?? '').replace(/\D/g, ''),
      })
    } catch (err) {
      setFormError(
        err instanceof Error && err.message
          ? err.message
          : 'We could not verify your student account. Please try again.',
      )
      setStep('form')
      setBusy(false)
    }
  }

  const setField = (field: keyof RegisterPayload, value: string) => {
    setForm((p) => ({ ...p, [field]: value }))
    if (errors[field as keyof FieldErrors]) setErrors((p) => ({ ...p, [field]: undefined }))
  }

  /** Leave the Google pathway: drop the token and let the names be edited. */
  const unlockNames = () => {
    // Switching to manual registration must not keep names Google supplied.
    setForm((p) => ({ ...p, googleIdToken: undefined, firstName: '', lastName: '' }))
    setErrors((p) => ({ ...p, firstName: undefined, lastName: undefined }))
  }

  // ------- Single registration form (email + profile merged) -------
  const Form = (
    <div key="form" className="animate-ryde-step flex flex-col">
      <h1 className="text-[26px] font-bold tracking-tight text-foreground">Join Rydepus as Student</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Ride with your classmates, split the fare, get there together.</p>

      <div className="mt-7">
        {googleAvailable && (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleBusy || busy}
            className="btn-press flex h-13 w-full items-center justify-center gap-3 rounded-lg border border-border bg-card text-sm font-semibold text-foreground transition-all duration-200 hover:bg-accent hover:shadow-sm disabled:opacity-60"
          >
            {googleBusy ? <Spinner size="sm" className="text-muted-foreground" /> : <GoogleIcon />}
            {googleBusy ? 'Connecting to Google…' : 'Continue with Google'}
          </button>
        )}

        {googleAvailable && (
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-muted" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-muted" />
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <NameAndPasswordFields
            firstName={form.firstName}
            lastName={form.lastName}
            password={form.password}
            hideConfirmation
            confirmation={form.confirmPassword}
            locked={googleLinked}
            errors={errors}
            onFirstName={(v) => setField('firstName', v)}
            onLastName={(v) => setField('lastName', v)}
            onPassword={(v) => setField('password', v)}
            onConfirmation={(v) => setField('confirmPassword', v)}
            onUnlockNames={unlockNames}
          />
          <DarkField
            label="Email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@campus.edu.ng"
            value={form.email ?? ''}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
            readOnly={googleLinked}
            hint={googleLinked ? 'Taken from your Google account.' : undefined}
            className={googleLinked ? 'border-ring/40 bg-accent text-accent-foreground' : undefined}
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
          {formError && <Alert tone="error-dark">{formError}</Alert>}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={busy}
            className="mt-2 h-14 rounded-lg bg-gradient-to-r from-primary to-primary text-base font-semibold shadow-sm transition-all duration-200 hover:from-primary/90 hover:to-primary/90 hover:shadow-md"
          >
            {busy ? 'Creating account…' : 'Create Student Account'}
          </Button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary underline-offset-4 transition-colors hover:underline">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        <Link to="/register" className="font-semibold text-primary underline-offset-4 transition-colors hover:underline">
          ← Choose a different role
        </Link>
      </p>
    </div>
  )

  // ------- Verifying -------
  const VerifyingStep = (
    <div key="verifying" className="animate-ryde-step flex flex-col items-center pt-14 text-center">
      <VerifyingTimer navigate={navigate} />
      <div className="relative mb-10 h-20 w-40">
        <div className="absolute inset-0 rounded-full bg-primary/25 blur-2xl animate-pulse" />
        <div className="relative flex items-center justify-center pt-2">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary shadow-primary/25">
            <span className="text-[28px] font-bold leading-none text-foreground">R</span>
          </span>
          <span className="-ml-1 text-[32px] font-light leading-none text-foreground">y</span>
        </div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Verifying Student Status…</h2>
      <p className="mt-2 max-w-[260px] text-sm text-muted-foreground">This might take a moment.</p>
      <span className="mt-8 size-9 animate-spin rounded-full border-[3px] border-border border-t-primary" />
    </div>
  )

  return (
    <AuthSplitLayout>
      {step === 'verifying' ? VerifyingStep : Form}
    </AuthSplitLayout>
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