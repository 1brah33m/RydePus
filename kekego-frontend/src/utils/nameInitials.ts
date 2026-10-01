/** Small text helpers shared by the registration screens. */

/** Uppercase initials of up to two names, e.g. ("Aisha", "Bello") -> "AB". */
export function initials(firstName: string, lastName?: string): string {
  return [firstName ?? '', lastName ?? '']
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
