import { DEMO_ACCOUNT, DEMO_DRIVER_ACCOUNT, MOCK_DRIVERS, MOCK_STUDENTS } from '../mock/data'
import type { RegisterPayload, Student, UserRole } from '../types'
import { delay } from '../utils/delay'
import * as backend from './mockBackend'

/**
 * Authentication service.
 *
 * Mock implementation. Swap the internals with real HTTP calls later:
 *   POST /api/v1/auth/login
 *   POST /api/v1/auth/register
 *   GET  /api/v1/auth/me
 *   POST /api/v1/auth/logout
 *
 * The UI never calls these endpoints directly.
 */

const PASSWORDS_KEY = 'transitx.passwords.v1'

/** Per-account role, keyed by student id (drivers register through the same table). */
const ROLES_KEY = 'transitx.userRoles.v1'

type PasswordMap = Record<string, string>

type RoleMap = Record<string, UserRole>

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function loadPasswords(): PasswordMap {
  return loadJson<PasswordMap>(PASSWORDS_KEY) ?? {}
}

function savePasswords(map: PasswordMap): void {
  localStorage.setItem(PASSWORDS_KEY, JSON.stringify(map))
}

function loadRoles(): RoleMap {
  return loadJson<RoleMap>(ROLES_KEY) ?? {}
}

function saveRoles(map: RoleMap): void {
  localStorage.setItem(ROLES_KEY, JSON.stringify(map))
}

function roleForStudent(studentId: string): UserRole {
  return loadRoles()[studentId] ?? 'student'
}

/** Seed demo accounts, passwords and roles on first launch. */
function ensureSeedData(): void {
  const current = backend.getDb()
  if (current.students.length === 0) {
    MOCK_STUDENTS.forEach((s) => backend.addStudent(s))
  }

  const passwords = loadPasswords()
  const roles = loadRoles()
  let changed = false

  MOCK_STUDENTS.forEach((s) => {
    if (!passwords[s.id]) {
      passwords[s.id] = DEMO_ACCOUNT.password
      changed = true
    }
    if (!roles[s.id]) {
      roles[s.id] = 'student'
      changed = true
    }
  })

  // A demo driver so the driver dashboard can be reached by logging in.
  if (!backend.getStudents().some((s) => s.email === DEMO_DRIVER_ACCOUNT.email)) {
    const demoDriver: Student = {
      id: 'st-demo-driver',
      fullName: MOCK_DRIVERS[2].name,
      department: '',
      faculty: '',
      level: '',
      phone: MOCK_DRIVERS[2].phone,
      email: DEMO_DRIVER_ACCOUNT.email,
    }
    backend.addStudent(demoDriver)
    if (!passwords[demoDriver.id]) {
      passwords[demoDriver.id] = DEMO_DRIVER_ACCOUNT.password
      changed = true
    }
    if (!roles[demoDriver.id]) {
      roles[demoDriver.id] = 'driver'
      changed = true
    }
  }

  if (changed) {
    savePasswords(passwords)
    saveRoles(roles)
  }
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase()
}

export class AuthService {
  /** Log in with email/phone and password. Throws Error on failure. */
  async login(identifier: string, password: string): Promise<Student> {
    await delay(800)
    ensureSeedData()

    const key = normalizeIdentifier(identifier)
    const student = backend.getStudents().find(
      (s) => normalizeIdentifier(s.email) === key || s.phone.replace(/\s+/g, '') === identifier.replace(/\s+/g, ''),
    )

    if (!student) {
      throw new Error('No account found with that email or phone number.')
    }
    const passwords = loadPasswords()
    if (passwords[student.id] !== password) {
      throw new Error('Incorrect password. Please try again.')
    }

    backend.persistSession(student.id)
    backend.persistRole(roleForStudent(student.id))
    return student
  }

  /** Register a new account. Throws Error on validation failure. */
  async register(payload: RegisterPayload, role: UserRole = 'student'): Promise<Student> {
    await delay(1000)
    ensureSeedData()

    const email = normalizeIdentifier(payload.email)
    const phone = (payload.phone ?? '').replace(/\s+/g, '')
    const exists = backend.getStudents().some(
      (s) => normalizeIdentifier(s.email) === email || s.phone.replace(/\s+/g, '') === phone,
    )
    if (exists) {
      throw new Error('An account with this email or phone number already exists.')
    }

    const student: Student = {
      id: crypto.randomUUID(),
      fullName: payload.fullName.trim(),
      department: payload.department?.trim() ?? '',
      faculty: payload.faculty?.trim() ?? '',
      level: payload.level ?? '',
      phone: payload.phone?.trim() ?? '',
      email: payload.email.trim().toLowerCase(),
      ...(payload.matricNumber ? { matricNumber: payload.matricNumber.trim() } : {}),
    }

    backend.addStudent(student)
    const passwords = loadPasswords()
    passwords[student.id] = payload.password || 'password123'
    savePasswords(passwords)

    const roles = loadRoles()
    roles[student.id] = role
    saveRoles(roles)

    backend.persistSession(student.id)
    backend.persistRole(role)
    return student
  }

  /** Restore the session for the currently logged-in user, if any. */
  async getSession(): Promise<Student | null> {
    const studentId = backend.readSession()
    if (!studentId) return null
    ensureSeedData()
    const student = backend.findStudent(studentId)
    if (!student) return null
    backend.persistRole(roleForStudent(student.id))
    return student
  }

  /** Role of the current session. Falls back to 'student' when none stored. */
  getRole(): UserRole {
    return backend.readRole() ?? 'student'
  }

  /** Update the signed-in student's profile (mock — backend-owned in production). */
  async updateProfile(studentId: string, updates: Partial<Student>): Promise<Student> {
    await delay(500)
    const current = backend.findStudent(studentId)
    if (!current) throw new Error('Student not found.')
    return backend.updateStudent({ ...current, ...updates })
  }

  logout(): void {
    backend.clearSession()
    backend.clearRole()
  }
}

export const authService = new AuthService()