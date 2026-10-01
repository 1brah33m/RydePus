/** Shared registration fields used by the student and driver sign-up flows. */

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { DarkField } from '../../components/ui/DarkField'
import { PASSWORD_HINT } from '../../config/password'

/** Official four-color Google "G" mark. */
export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

/**
 * First name, last name, password and confirmation for both roles.
 *
 * When `locked` is true the names came from a verified Google token: they are
 * shown read-only with a "use a different name" escape hatch, because the server
 * always prefers the token's values and would silently discard typed edits.
 */
export function NameAndPasswordFields({
  firstName,
  lastName,
  password,
  confirmation,
  locked,
  errors,
  onFirstName,
  onLastName,
  onPassword,
  onConfirmation,
  onUnlockNames,
}: {
  firstName: string
  lastName: string
  password: string
  confirmation: string
  locked: boolean
  errors: { firstName?: string; lastName?: string; password?: string; confirmation?: string }
  onFirstName: (value: string) => void
  onLastName: (value: string) => void
  onPassword: (value: string) => void
  onConfirmation: (value: string) => void
  onUnlockNames: () => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  return (
    <>
      {locked && (
        <p className="-mb-1 rounded-xl border border-brand-400/30 bg-brand-400/10 px-3.5 py-2.5 text-[13px] leading-snug text-brand-300">
          Name taken from your Google profile.{' '}
          <button type="button" onClick={onUnlockNames} className="font-semibold underline hover:text-white">
            Use a different name
          </button>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <DarkField
          label="First name"
          autoComplete="given-name"
          placeholder="e.g. Aisha"
          value={firstName}
          onChange={(e) => onFirstName(e.target.value)}
          error={errors.firstName}
          readOnly={locked}
          className={locked ? 'border-brand-400/40 bg-brand-400/[0.06] text-brand-200' : undefined}
        />
        <DarkField
          label="Last name"
          autoComplete="family-name"
          placeholder="e.g. Bello"
          value={lastName}
          onChange={(e) => onLastName(e.target.value)}
          error={errors.lastName}
          readOnly={locked}
          className={locked ? 'border-brand-400/40 bg-brand-400/[0.06] text-brand-200' : undefined}
        />
      </div>

      <DarkField
        label="Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="••••••••••"
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        error={errors.password}
        hint={PASSWORD_HINT}
        trailingIcon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="text-ink-400 transition hover:text-white"
          >
            {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </button>
        }
      />
      <DarkField
        label="Confirm password"
        type={showConfirmation ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="••••••••••"
        value={confirmation}
        onChange={(e) => onConfirmation(e.target.value)}
        error={errors.confirmation}
        trailingIcon={
          <button
            type="button"
            onClick={() => setShowConfirmation((v) => !v)}
            aria-label={showConfirmation ? 'Hide password' : 'Show password'}
            className="text-ink-400 transition hover:text-white"
          >
            {showConfirmation ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </button>
        }
      />
    </>
  )
}
