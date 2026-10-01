import type { RegisterPayload, Student, UserRole } from '../types'
import { apiClient } from './apiClient'
import type { VerifiedGoogleIdentity } from './googleAuth'

export type { VerifiedGoogleIdentity }

/**
 * Authentication service — wired to the Django backend.
 *
 * Endpoint mapping:
 *   POST /api/v1/auth/login/           -> login()
 *   POST /api/v1/auth/register/        -> register()
 *   POST /api/v1/auth/google/identity/ -> resolveGoogleIdentity()
 *   GET  /api/v1/auth/me/              -> getSession()
 *   PATCH /api/v1/auth/me/             -> updateProfile()
 *   POST /api/v1/auth/change-password/ -> changePassword()
 *   (none)                             -> logout() (local token clear; the
 *                                          backend has no revocation endpoint)
 *
 * Adapter notes:
 * - The backend authenticates with email only. The frontend previously
 *   accepted a phone number; phone login is not supported by the API.
 * - The backend User has no department/faculty/level fields, so those student
 *   profile fields are kept on the client only and reset to "" after a fresh
 *   login until the backend grows them.
 * - Roles are uppercase on the backend (STUDENT / DRIVER) and lowercase in the
 *   frontend (student / driver).
 * - Registration requires first name, last name, a password and its
 *   confirmation. There is no default password.
 */

const SESSION_KEY = 'rydepus.session.v1'

interface SessionData {
  student: Student
  role: UserRole
}

interface ApiUser {
  id: number
  email: string
  phone_number: string
  first_name: string
  last_name: string
  full_name: string
  role: 'STUDENT' | 'DRIVER'
}

interface AuthResponse {
  user: ApiUser
  access: string
  refresh: string
}

function roleFromApi(role: ApiUser['role']): UserRole {
  return role === 'DRIVER' ? 'driver' : 'student'
}

function studentFromApi(user: ApiUser): Student {
  return {
    id: String(user.id),
    fullName: user.full_name,
    department: '',
    faculty: '',
    level: '',
    phone: user.phone_number ?? '',
    email: user.email,
  }
}

function readSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionData) : null
  } catch {
    return null
  }
}

function saveSession(student: Student, role: UserRole): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ student, role } satisfies SessionData))
  } catch {
    /* storage unavailable */
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** "First Second Names" -> { first_name, last_name } for the backend. */
function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' ') ?? '',
  }
}

function buildRegisterBody(payload: RegisterPayload, role: UserRole): Record<string, string> {
  const password = payload.password
  if (!password) {
    // Never invent a password: a weak default would be a real account compromise.
    throw new Error('Choose a password before creating your account.')
  }
  if (payload.confirmPassword !== password) {
    throw new Error('The two passwords do not match.')
  }

  const body: Record<string, string> = {
    email: payload.email.trim().toLowerCase(),
    password,
    confirm_password: payload.confirmPassword,
    role: role === 'driver' ? 'DRIVER' : 'STUDENT',
    first_name: payload.firstName.trim(),
    last_name: payload.lastName.trim(),
  }
  if (payload.phone?.trim()) body.phone_number = payload.phone.trim()
  if (payload.googleIdToken) body.google_id_token = payload.googleIdToken
  return body
}

export class AuthService {
  /** Log in with email and password. Throws Error on failure. */
  async login(identifier: string, password: string): Promise<Student> {
    const email = identifier.trim()
    if (!email.includes('@')) {
      throw new Error('Sign-in uses email. Enter the email you registered with.')
    }

    const data = await apiClient.post<AuthResponse>('/auth/login/', {
      email: email.toLowerCase(),
      password,
    })

    const student = studentFromApi(data.user)
    const role = roleFromApi(data.user.role)
    apiClient.setTokens(data.access, data.refresh)
    saveSession(student, role)
    return student
  }

  /** Register a new account on the API. Throws Error on validation failure. */
  async register(payload: RegisterPayload, role: UserRole = 'student'): Promise<Student> {
    const data = await apiClient.post<AuthResponse>('/auth/register/', buildRegisterBody(payload, role))

    const student = studentFromApi(data.user)
    const storedRole = roleFromApi(data.user.role)
    apiClient.setTokens(data.access, data.refresh)
    saveSession(student, storedRole)
    return student
  }

  /**
   * Exchange a Google ID token for the identity fields registration may use.
   *
   * The token is verified server-side; the response contains only the email and
   * the first/last name taken from the Google profile.
   */
  async resolveGoogleIdentity(idToken: string): Promise<VerifiedGoogleIdentity> {
    return apiClient.post<VerifiedGoogleIdentity>('/auth/google/identity/', { id_token: idToken })
  }

  /** Restore the session for the currently signed-in user, if any. */
  async getSession(): Promise<Student | null> {
    if (!apiClient.hasTokens()) return null
    try {
      const user = await apiClient.get<ApiUser>('/auth/me/', { auth: true })
      const student = studentFromApi(user)
      saveSession(student, roleFromApi(user.role))
      return student
    } catch {
      apiClient.clearTokens()
      return null
    }
  }

  /** Role of the current session. Falls back to 'student' when not stored. */
  getRole(): UserRole {
    const session = readSession()
    if (session?.role === 'student' || session?.role === 'driver') return session.role
    return 'student'
  }

  /** Update profile fields the backend supports (name and phone). */
  async updateProfile(_studentId: string, updates: Partial<Student>): Promise<Student> {
    const body: { first_name?: string; last_name?: string; phone_number?: string } = {}
    if (updates.fullName !== undefined) {
      const names = splitFullName(updates.fullName)
      body.first_name = names.first_name
      body.last_name = names.last_name
    }
    if (updates.phone !== undefined) {
      body.phone_number = updates.phone.trim()
    }

    const user = await apiClient.patch<ApiUser>('/auth/me/', body, { auth: true })
    const previous = readSession()?.student
    const serverFields = studentFromApi(user)

    // The backend has no department/faculty/level, so keep the values the user
    // just submitted (or their previous client-side values) rather than wiping them.
    const merged: Student = {
      ...previous,
      ...serverFields,
      id: String(user.id),
      department: updates.department ?? previous?.department ?? serverFields.department,
      faculty: updates.faculty ?? previous?.faculty ?? serverFields.faculty,
      level: updates.level ?? previous?.level ?? serverFields.level,
    }
    saveSession(merged, roleFromApi(user.role))
    return merged
  }

  /** Change the signed-in user's password on the API. */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiClient.post(
      '/auth/change-password/',
      { old_password: oldPassword, new_password: newPassword },
      { auth: true },
    )
  }

  logout(): void {
    apiClient.clearTokens()
    clearSession()
  }
}

export const authService = new AuthService()