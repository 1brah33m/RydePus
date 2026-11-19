import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Key01Icon, Mail01Icon } from 'hugeicons-react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { homePathForRole } from '../../utils/routing'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Alert } from '../../components/ui/Alert'
import { AuthSplitLayout } from '../../components/ui/AuthSplitLayout'

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

  return (
    <AuthSplitLayout title="Welcome back" subtitle="Sign in to continue your ride.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          tone="dark"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@campus.edu.ng"
          leadingIcon={<Mail01Icon aria-hidden className="size-4.5" />}
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
          leadingIcon={<Key01Icon aria-hidden className="size-4.5" />}
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
          className="rounded-lg bg-gradient-to-r from-primary to-primary text-base font-semibold shadow-sm transition-all duration-200 hover:from-primary/90 hover:to-primary/90 hover:shadow-md"
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Rydepus?{' '}
        <Link to="/register" className="font-semibold text-primary underline-offset-4 transition-colors hover:underline">
          Create an account
        </Link>
      </p>
    </AuthSplitLayout>
  )
}