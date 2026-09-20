import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CarFront, GraduationCap } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { homePathForRole } from '../../utils/routing'
import { AuthLayout } from './AuthLayout'

/** Ribbon of CTAs shown after "Create Account" — pick Student or Driver. */
export function RoleSelect() {
  const { status } = useAuth()
  const navigate = useNavigate()

  // Already signed in? No need to pick a role.
  useEffect(() => {
    if (status === 'authenticated') {
      navigate(homePathForRole(authService.getRole()), { replace: true })
    }
  }, [status, navigate])

  return (
    <AuthLayout title="Create your account" subtitle="Choose how you'll ride with KekeGo.">
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate('/register/student')}
          className="flex h-14 w-full items-center justify-between rounded-full bg-brand-500 px-6 text-base font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            <GraduationCap aria-hidden className="size-5" />
            Join as Student
          </span>
          <ArrowRight aria-hidden className="size-5" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/register/driver')}
          className="flex h-14 w-full items-center justify-between rounded-full border-2 border-brand-500 bg-transparent px-6 text-base font-bold text-white transition hover:bg-brand-500/10 active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            <CarFront aria-hidden className="size-5" />
            Join as Driver
          </span>
          <ArrowRight aria-hidden className="size-5" />
        </button>
      </div>

      <p className="mt-8 text-center text-sm text-ink-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-400 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}