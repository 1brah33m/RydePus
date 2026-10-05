import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { RegisterPayload, Student, UserRole } from '../types'
import { authService } from '../services/authService'

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  /**
   * False only until the initial stored-session check has resolved. Guards use
   * this to tell "we do not know who this is yet, show a spinner" apart from
   * "a sign-in the user just submitted is in flight", where the form must stay
   * mounted so its state and error message survive.
   */
  sessionReady: boolean
  student: Student | null
  role: UserRole | null
  login: (identifier: string, password: string) => Promise<void>
  register: (payload: RegisterPayload, role?: UserRole) => Promise<void>
  updateStudent: (updates: Partial<Student>) => Promise<void>
  logout: () => void
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [sessionReady, setSessionReady] = useState(false)
  const [student, setStudent] = useState<Student | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    authService
      .getSession()
      .then((current) => {
        if (cancelled) return
        setSessionReady(true)
        if (current) {
          setStudent(current)
          setRole(authService.getRole())
          setStatus('authenticated')
        } else {
          setRole(null)
          setStatus('unauthenticated')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionReady(true)
          setStatus('unauthenticated')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const login = useCallback(async (identifier: string, password: string) => {
    setError(null)
    setStatus('loading')
    try {
      const current = await authService.login(identifier, password)
      setStudent(current)
      setRole(authService.getRole())
      setStatus('authenticated')
    } catch (err) {
      setStatus('unauthenticated')
      setError(err instanceof Error ? err.message : 'Unable to sign in.')
      throw err
    }
  }, [])

  const register = useCallback(async (payload: RegisterPayload, role: UserRole = 'student') => {
    setError(null)
    setStatus('loading')
    try {
      const current = await authService.register(payload, role)
      setStudent(current)
      setRole(authService.getRole())
      setStatus('authenticated')
    } catch (err) {
      setStatus('unauthenticated')
      setError(err instanceof Error ? err.message : 'Unable to create account.')
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setStudent(null)
    setRole(null)
    setStatus('unauthenticated')
  }, [])

  const updateStudent = useCallback(async (updates: Partial<Student>) => {
    if (!student) throw new Error('No signed-in student.')
    const updated = await authService.updateProfile(student.id, updates)
    setStudent(updated)
  }, [student])

  const value = useMemo<AuthContextValue>(
    () => ({ status, sessionReady, student, role, login, register, updateStudent, logout, error, clearError }),
    [status, sessionReady, student, role, login, register, updateStudent, logout, error, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook export by design
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}