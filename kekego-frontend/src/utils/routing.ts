import type { UserRole } from '../types'

export const STUDENT_HOME = '/home'
export const DRIVER_HOME = '/driver'

/** Primary dashboard path for a role; students also own the auth-flows' home. */
export function homePathForRole(role: UserRole | null | undefined): string {
  return role === 'driver' ? DRIVER_HOME : STUDENT_HOME
}