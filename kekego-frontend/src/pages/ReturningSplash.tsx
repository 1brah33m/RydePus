import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homePathForRole } from '../utils/routing'
import { Logo } from '../components/ui/Logo'

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName
}

/**
 * Brief splash shown to authenticated users right after the app opens.
 * Verifies the session, greets the user by name, then routes to their
 * role-specific dashboard.
 */
export function ReturningSplash() {
  const navigate = useNavigate()
  const { student, role } = useAuth()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(homePathForRole(role), { replace: true })
    }, 1800)
    return () => clearTimeout(timer)
  }, [navigate, role])

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-charcoal px-6 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 45% at 50% 40%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 60%)',
        }}
      />

      <div className="relative flex flex-col items-center">
        <Logo tone="dark" className="scale-110" />

        {/* circular loader */}
        <div className="relative mt-10 flex size-14 items-center justify-center" role="status" aria-label="Loading">
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-white/10 border-t-white" />
          <span className="absolute inset-2 rounded-full border-2 border-white/5 border-b-white/30 animate-spin [animation-direction:reverse] [animation-duration:0.9s]" />
        </div>

        {student && (
          <p className="mt-8 text-lg font-semibold text-white">
            Welcome back, <span className="text-ink-300">{firstName(student.fullName)}</span>.
          </p>
        )}
      </div>

      <p className="absolute bottom-10 text-xs text-ink-500">KekeGo — Campus Shuttle</p>
    </div>
  )
}