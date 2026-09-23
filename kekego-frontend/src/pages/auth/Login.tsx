import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { DEMO_ACCOUNT, DEMO_DRIVER_ACCOUNT } from '../../mock/data'
import { homePathForRole } from '../../utils/routing'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { AuthLayout } from './AuthLayout'

interface Validation {
  identifier: string | null
  password: string | null
}

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Validation>({ identifier: null, password: null })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const nextErrors: Validation = { identifier: null, password: null }
    if (!identifier.trim()) nextErrors.identifier = 'Enter your email or phone number.'
    if (!password) nextErrors.password = 'Enter your password.'
    setErrors(nextErrors)
    if (nextErrors.identifier || nextErrors.password) return

    setBusy(true)
    setFormError(null)
    try {
      await login(identifier, password)
      navigate(homePathForRole(authService.getRole()), { replace: true })
    } catch {
      setFormError('We could not sign you in. Check your details and try again.')
    } finally {
      setBusy(false)
    }
  }

  const fillDemo = () => {
    setIdentifier(DEMO_ACCOUNT.email)
    setPassword(DEMO_ACCOUNT.password)
    setErrors({ identifier: null, password: null })
    setFormError(null)
  }

  const fillDriverDemo = () => {
    setIdentifier(DEMO_DRIVER_ACCOUNT.email)
    setPassword(DEMO_DRIVER_ACCOUNT.password)
    setErrors({ identifier: null, password: null })
    setFormError(null)
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue your ride.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          tone="dark"
          label="Email or phone"
          type="text"
          autoComplete="email"
          placeholder="you@campus.edu.ng"
          leadingIcon={<Mail aria-hidden className="size-4.5" />}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={errors.identifier ?? undefined}
        />
        <Input
          tone="dark"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          leadingIcon={<Lock aria-hidden className="size-4.5" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password ?? undefined}
        />

        {formError && (
          <Alert tone="error-dark">{formError}</Alert>
        )}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={busy}
          className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-base font-semibold shadow-sm hover:from-brand-400 hover:to-brand-500"
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-5 rounded-xl border border-dashed border-white/10 bg-white/[0.04] p-3.5 text-center">
        <p className="text-xs text-ink-500">Just exploring? Use a demo account.</p>
        <button
          type="button"
          onClick={fillDemo}
          className="mt-1 text-sm font-semibold text-brand-400 hover:underline"
        >
          Student · {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}
        </button>
        <div className="mx-auto my-2 h-px w-3/4 bg-white/10" />
        <button
          type="button"
          onClick={fillDriverDemo}
          className="text-sm font-semibold text-brand-400 hover:underline"
        >
          Driver · {DEMO_DRIVER_ACCOUNT.email} · {DEMO_DRIVER_ACCOUNT.password}
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-ink-400">
        New to Rydepus?{' '}
        <Link to="/register" className="font-semibold text-brand-400 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}