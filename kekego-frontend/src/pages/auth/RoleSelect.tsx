import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight01Icon, Car01Icon, GraduationScrollIcon } from 'hugeicons-react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { homePathForRole } from '../../utils/routing'
import { AuthSplitLayout } from '../../components/ui/AuthSplitLayout'

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
    <AuthSplitLayout title="Create your account" subtitle="Choose how you'll ride with Rydepus.">
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate('/register/student')}
          className="btn-press group flex h-14 w-full animate-ryde-rise animate-delay-150 items-center justify-between rounded-lg bg-primary px-6 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
        >
          <span className="flex items-center gap-3">
            <GraduationScrollIcon aria-hidden className="size-5 transition-transform duration-200 group-hover:scale-110" />
            Join as Student
          </span>
          <ArrowRight01Icon aria-hidden className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/register/driver')}
          className="btn-press group flex h-14 w-full animate-ryde-rise animate-delay-225 items-center justify-between rounded-lg border-2 border-border bg-transparent px-6 text-base font-bold text-foreground transition-all duration-200 hover:border-ring/60 hover:bg-accent"
        >
          <span className="flex items-center gap-3">
            <Car01Icon aria-hidden className="size-5 transition-transform duration-200 group-hover:scale-110" />
            Join as Driver
          </span>
          <ArrowRight01Icon aria-hidden className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </div>

      <p className="mt-8 animate-ryde-rise animate-delay-300 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary underline-offset-4 transition-colors hover:underline">
          Log in
        </Link>
      </p>
    </AuthSplitLayout>
  )
}