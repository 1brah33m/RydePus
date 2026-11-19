import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckmarkSquare02Icon, CloudUploadIcon } from 'hugeicons-react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { isGoogleSignInConfigured, requestGoogleIdToken } from '../../services/googleAuth'
import type { RegisterPayload } from '../../types'
import { homePathForRole } from '../../utils/routing'
import { validatePassword } from '../../config/password'
import { AuthSplitLayout } from '../../components/ui/AuthSplitLayout'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { DarkField } from '../../components/ui/DarkField'
import { Logo } from '../../components/ui/Logo'
import { driverService } from '../../services/driverService'
import { GoogleIcon, NameAndPasswordFields } from './sharedAuth'
import { cn } from '../../utils/cn'

type Step = 'form' | 'verifying'

interface DrivingDetails {
  phone: string
  plateNumber: string
  licenseFile: string | null
}

type FieldErrors = Partial<
  Record<
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'plateNumber'
    | 'licenseFile'
    | 'password'
    | 'confirmation',
    string
  >
>

export function DriverRegister() {
  const { register, status } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('form')
  const [form, setForm] = useState<RegisterPayload>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [details, setDetails] = useState<DrivingDetails>({ phone: '', plateNumber: '', licenseFile: null })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** True when the name/email came from a verified Google token. */
  const googleLinked = Boolean(form.googleIdToken)
  const googleAvailable = isGoogleSignInConfigured()

  // Redirect if already authenticated and not on the verifying screen.
  useEffect(() => {
    if (status === 'authenticated' && step !== 'verifying') {
      navigate(homePathForRole(authService.getRole()), { replace: true })
    }
  }, [status, step, navigate])

  // ----- Google sign-in ----------------------------------------------------

  /**
   * Real Google sign-in. The ID token is verified by the backend, which replies
   * with the first/last name we are allowed to prefill from the Google profile.
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

  // ----- Driver details step ------------------------------------------------

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setDetails((p) => ({ ...p, licenseFile: file.name }))
    setErrors((p) => ({ ...p, licenseFile: undefined }))
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

  const validateForm = (): boolean => {
    const emailValue = form.email.trim()
    const phoneDigits = details.phone.replace(/\D/g, '')
    const next: FieldErrors = {}
    if (!form.firstName.trim()) next.firstName = 'Enter your first name.'
    if (!form.lastName.trim()) {
      next.lastName = googleLinked
        ? 'Your Google account has no last name. Use "use a different name" to add one.'
        : 'Enter your last name.'
    }
    if (!emailValue) next.email = 'Enter your email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) next.email = 'Enter a valid email address.'
    if (!details.phone.trim()) next.phone = 'Enter your phone number.'
    else if (!/^0[0-9]{10}$/.test(phoneDigits)) next.phone = 'Enter a valid 11-digit phone number (e.g. 08012345678).'
    if (!details.plateNumber.trim()) next.plateNumber = 'Enter your vehicle plate number.'
    else if (!/^[A-Za-z]{1,3}[-\s]?\d{1,6}[-\s]?[A-Za-z]{0,3}$/.test(details.plateNumber.trim())) {
      next.plateNumber = 'Plate looks invalid (e.g. EPE-789XY).'
    }
    if (!details.licenseFile) next.licenseFile = 'Upload your permit or license.'
    const passwordError = validatePassword(form.password)
    if (passwordError) next.password = passwordError
    setErrors(next)
    return Object.values(next).every((message) => !message)
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setBusy(true)
    setFormError(null)
    setStep('verifying')
    try {
      // Register the driver account, then record the vehicle plate so the
      // driver profile exists with their permit details.
      await register(
        {
          ...form,
          // The confirm-password field was removed from the form, but the
          // backend still requires a matching `confirm_password`: mirror it.
          confirmPassword: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: details.phone.replace(/\D/g, ''),
        },
        'driver',
      )
      await driverService.updateAvailability({ vehicle_plate: details.plateNumber.trim().toUpperCase() })
    } catch (err) {
      setFormError(
        err instanceof Error && err.message
          ? err.message
          : 'We could not verify your driver credentials. Please try again.',
      )
      setStep('form')
      setBusy(false)
    }
  }

  // ------- Single registration form (account + verification merged) -------
  const FormStep = (
    <div key="form" className="animate-ryde-step flex flex-col">
      <h1 className="text-[26px] font-bold tracking-tight text-foreground">Join Rydepus as Driver</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Create your account to get started.</p>

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

        <form onSubmit={handleRegister} className="space-y-4" noValidate>
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
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
            readOnly={googleLinked}
            hint={googleLinked ? 'Taken from your Google account.' : undefined}
            className={googleLinked ? 'border-ring/40 bg-accent text-accent-foreground' : undefined}
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
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Vehicle permit / license
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 transition',
                details.licenseFile
                  ? 'border-ring/50 bg-accent'
                  : errors.licenseFile
                    ? 'border-destructive/60 bg-destructive/10'
                    : 'border-border bg-muted hover:border-ring/50 hover:bg-accent',
              )}
            >
              {details.licenseFile ? (
                <>
                  <CheckmarkSquare02Icon aria-hidden className="size-6 text-primary" />
                  <span className="mx-auto max-w-full truncate text-sm font-medium text-primary">
                    {details.licenseFile}
                  </span>
                  <span className="text-xs text-muted-foreground">Epe campus zone verification</span>
                </>
              ) : (
                <>
                  <CloudUploadIcon aria-hidden className="size-6 text-muted-foreground" />
                  <span className="rounded-lg bg-muted px-4 py-1.5 text-sm font-semibold text-foreground transition hover:bg-accent">
                    Upload File
                  </span>
                  <span className="text-xs text-muted-foreground">Permit/license for Epe campus zone · PDF, JPG or PNG</span>
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
            className="mt-2 h-14 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
          >
            {busy ? 'Submitting…' : 'Register as Driver'}
          </Button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/register" className="font-semibold text-primary underline-offset-4 transition-colors hover:underline">
          ← Choose a different role
        </Link>
      </p>
    </div>
  )

  // ------- Step 3 · verifying -------
  const VerifyingStep = (
    <div key="verifying" className="animate-ryde-step flex flex-col items-center pt-14 text-center">
      <VerifyingTimer navigate={navigate} />
      <Logo tone="dark" className="animate-pulse" />
      <h2 className="mt-10 text-2xl font-bold tracking-tight text-foreground">
        Verifying Driver Credentials…
      </h2>
      <p className="mt-2 max-w-[260px] text-sm text-muted-foreground">This might take a moment.</p>
      <span className="mt-8 size-9 animate-spin rounded-full border-[3px] border-border border-t-primary" />
    </div>
  )

  return (
    <AuthSplitLayout>
      {step === 'verifying' ? VerifyingStep : FormStep}
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