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
 * - The academic fields department/faculty/level/matric_number are stored on
 *   the backend User and round-trip through every auth response, so they are
 *   read straight off the API payload rather than cached in the browser.
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
  department: string
  faculty: string
  level: string
  matric_number: string
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

/**
 * Build a Student from an API user.
 *
 * Every entry point funnels through here - login, registration and the
 * bootstrap session check - so mapping the API's snake_case fields here is
 * enough for the profile page to stay populated across reloads.
 */
function studentFromApi(user: ApiUser): Student {
  return {
    id: String(user.id),
    fullName: user.full_name,
    department: user.department ?? '',
    faculty: user.faculty ?? '',
    level: user.level ?? '',
    phone: user.phone_number ?? '',
    email: user.email,
    ...(user.matric_number ? { matricNumber: user.matric_number } : {}),
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

const GENERIC_LOGIN_ERROR = 'We could not sign you in. Check your email and password and try again.'

/** Anything object-shaped that might carry a server response body. */
type MaybeResponse = {
  detail?: unknown
  non_field_errors?: unknown
  error?: { message?: unknown } | unknown
  errors?: Record<string, unknown>
  message?: unknown
  response?: { data?: MaybeResponse }
  data?: MaybeResponse
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item)
      if (found) return found
    }
  }
  if (value && typeof value === 'object') {
    // DRF nests messages differently depending on the failure: a field map such
    // as { email: ['Enter a valid email address.'] }, or { field: { detail } }.
    // Prefer explicit message/detail keys, then walk the values.
    const record = value as Record<string, unknown>
    const direct = firstString(record.message) ?? firstString(record.detail)
    if (direct) return direct
    for (const nested of Object.values(record)) {
      const found = firstString(nested)
      if (found) return found
    }
  }
  return null
}

/**
 * Best-effort extraction of a readable message from a failed login.
 *
 * `apiClient` already unwraps the shared `{ error: { message } }` envelope and
 * throws a plain `Error`, so `err.message` is the normal path. The other shapes
 * are handled defensively so a login failure can never surface as a blank alert
 * if the transport ever changes (raw DRF `detail`, DRF `non_field_errors`, or
 * an axios-style `err.response.data` if the HTTP client is ever swapped).
 */
function messageFromLoginError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err.trim()) return err.trim()

  if (err && typeof err === 'object') {
    const candidates: MaybeResponse[] = []
    const asResponse = err as MaybeResponse
    if (asResponse.response?.data) candidates.push(asResponse.response.data)
    if (asResponse.data) candidates.push(asResponse.data)
    candidates.push(asResponse)

    for (const body of candidates) {
      const nested = body.error && typeof body.error === 'object' ? (body.error as { message?: unknown }) : null
      const found =
        firstString(nested?.message) ??
        firstString(body.detail) ??
        firstString(body.non_field_errors) ??
        firstString(body.errors) ??
        firstString(body.message)
      if (found) return found
    }
  }

  return GENERIC_LOGIN_ERROR
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
  if (payload.department?.trim()) body.department = payload.department.trim()
  if (payload.faculty?.trim()) body.faculty = payload.faculty.trim()
  if (payload.level) body.level = String(payload.level)
  if (payload.matricNumber?.trim()) body.matric_number = payload.matricNumber.trim()
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

    let data: AuthResponse
    try {
      data = await apiClient.post<AuthResponse>('/auth/login/', {
        email: email.toLowerCase(),
        password,
      })
    } catch (err) {
      // Surface the server's own wording (e.g. "Invalid email or password.")
      // rather than a generic alert, so the form tells the user what to fix.
      throw new Error(messageFromLoginError(err))
    }

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
    const body: {
      first_name?: string
      last_name?: string
      phone_number?: string
      department?: string
      faculty?: string
      level?: string
      matric_number?: string
    } = {}
    if (updates.fullName !== undefined) {
      const names = splitFullName(updates.fullName)
      body.first_name = names.first_name
      body.last_name = names.last_name
    }
    if (updates.phone !== undefined) {
      body.phone_number = updates.phone.trim()
    }
    if (updates.department !== undefined) {
      body.department = updates.department.trim()
    }
    if (updates.faculty !== undefined) {
      body.faculty = updates.faculty.trim()
    }
    if (updates.level !== undefined) {
      body.level = String(updates.level)
    }
    if (updates.matricNumber !== undefined) {
      body.matric_number = updates.matricNumber.trim()
    }

    const user = await apiClient.patch<ApiUser>('/auth/me/', body, { auth: true })
    // The API echoes the stored values back, so the response is authoritative;
    // no local merge is needed.
    const student = studentFromApi(user)
    saveSession(student, roleFromApi(user.role))
    return student
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