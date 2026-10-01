/**
 * Client-side password rules for registration.
 *
 * These mirror the Django AUTH_PASSWORD_VALIDATORS so the user gets an instant,
 * field-level message instead of a round-trip. The server remains the authority:
 * anything it rejects (common passwords, similarity to the user's name) still
 * comes back through the normal error path.
 */

/** Keep in sync with DJANGO_PASSWORD_MIN_LENGTH on the backend. */
export const PASSWORD_MIN_LENGTH = 10

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters.`

/** Returns a human-readable problem with the password, or null when it is fine. */
export function validatePassword(password: string): string | null {
  if (!password) return 'Choose a password.'
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (/^\d+$/.test(password.trim())) return 'Use more than just numbers.'
  return null
}

/** Returns a problem with the confirmation field, or null when it matches. */
export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Re-enter your password.'
  // Compared verbatim: passwords are never trimmed anywhere in this app.
  if (password !== confirmation) return 'The two passwords do not match.'
  return null
}

/** Runs both checks, returning only the first problem found. */
export function checkPasswords(
  password: string,
  confirmation: string,
): { password?: string; confirmation?: string } {
  const passwordError = validatePassword(password)
  if (passwordError) return { password: passwordError }
  const confirmationError = validatePasswordConfirmation(password, confirmation)
  if (confirmationError) return { confirmation: confirmationError }
  return {}
}
