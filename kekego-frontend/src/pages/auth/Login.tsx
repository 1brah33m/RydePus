import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
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
  const { login, error: authError, clearError } = useAuth()
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Validation>({ identifier: null, password: null })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // GuestOnly swaps this form out for a spinner while auth status is "loading",
  // which unmounts it and throws away `formError` before the failure comes back.
  // AuthContext.error lives above that unmount, so prefer it whenever set.
  const displayedError = formError ?? authError

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const nextErrors: Validation = { identifier: null, password: null }
    if (!identifier.trim()) nextErrors.identifier = 'Enter your email.'
    if (!password) nextErrors.password = 'Enter your password.'
    setErrors(nextErrors)
    if (nextErrors.identifier || nextErrors.password) return

    setBusy(true)
    setFormError(null)
    clearError()
    try {
      await login(identifier, password)
      navigate(homePathForRole(authService.getRole()), { replace: true })
    } catch (err) {
      setFormError(
        err instanceof Error && err.message ? err.message : 'We could not sign you in. Check your details and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const removeDemo = () => {
    setIdentifier('')
    setPassword('')
    setErrors({ identifier: null, password: null })
    setFormError(null)
    clearError()
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue your ride.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          tone="dark"
          label="Email"
          type="email"
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

        {displayedError && (
          <Alert tone="error-dark">{displayedError}</Alert>
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
        <p className="text-xs text-ink-500">Accounts are stored on the Rydepus API server.</p>
        <button
          type="button"
          onClick={removeDemo}
          className="mt-1 text-sm font-semibold text-brand-400 hover:underline"
        >
          New to Rydepus? Create an account first.
        </button>
        <div className="mx-auto my-2 h-px w-3/4 bg-white/10" />
        <p className="text-xs text-ink-500">
          Try the Student and Driver demo flows from the backend seed data, or register a fresh account.
        </p>
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