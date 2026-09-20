import { Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import { AppShell } from './components/navigation/AppShell'
import { Spinner } from './components/ui/Spinner'
import { PwaUpdateBanner } from './components/ui/PwaUpdateBanner'

import { ReturningSplash } from './pages/ReturningSplash'
import { Login } from './pages/auth/Login'
import { RoleSelect } from './pages/auth/RoleSelect'
import { Register } from './pages/auth/Register'
import { DriverRegister } from './pages/auth/DriverRegister'
import { LandingPage } from './pages/landing/LandingPage'
import { Home } from './pages/home/Home'
import { FindRide } from './pages/home/FindRide'
import { GroupsPage } from './pages/groups/GroupsPage'
import { CreateGroup } from './pages/groups/CreateGroup'
import { GroupStatus } from './pages/groups/GroupStatus'
import { TripsPage } from './pages/trips/TripsPage'
import { TripDetail } from './pages/trips/TripDetail'
import { Profile } from './pages/profile/Profile'
import { WalletPage } from './pages/wallet/Wallet'
import { DriverHome } from './pages/driver/DriverHome'
import { DriverRequests } from './pages/driver/DriverRequests'
import { DriverEarnings } from './pages/driver/DriverEarnings'
import { DriverProfile } from './pages/driver/DriverProfile'
import { PaymentReview } from './pages/payment/PaymentReview'
import { PaymentCheckout } from './pages/payment/PaymentCheckout'
import { homePathForRole } from './utils/routing'

/** Root route: onboarding for guests, a brief branded splash for returning users. */
function Landing() {
  const { status } = useAuth()
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-full items-center justify-center bg-charcoal">
        <Spinner size="lg" label="Loading KekeGo" className="text-white" />
      </div>
    )
  }
  if (status === 'authenticated') {
    return <ReturningSplash />
  }
  return <LandingPage />
}

/** Guard for student pages: authenticated drivers are bounced to the driver dashboard. */
function Protected({ children }: { children: ReactNode }) {
  const { status, role } = useAuth()
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-full items-center justify-center bg-ink-50 dark:bg-charcoal">
        <Spinner size="lg" label="Loading KekeGo" className="text-ink-900 dark:text-slate-100" />
      </div>
    )
  }
  if (status !== 'authenticated') {
    return <Navigate to="/" replace />
  }
  if (role === 'driver') {
    return <Navigate to={homePathForRole(role)} replace />
  }
  return <AppShell>{children}</AppShell>
}

/** Guard for the driver dashboard: students/unauthenticated are bounced away. */
function DriverProtected({ children }: { children: ReactNode }) {
  const { status, role } = useAuth()
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-full items-center justify-center bg-charcoal">
        <Spinner size="lg" label="Loading KekeGo" className="text-white" />
      </div>
    )
  }
  if (status !== 'authenticated') {
    return <Navigate to="/" replace />
  }
  if (role !== 'driver') {
    return <Navigate to={homePathForRole(role)} replace />
  }
  return <>{children}</>
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { status, role } = useAuth()
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-full items-center justify-center bg-ink-50 dark:bg-charcoal">
        <Spinner size="lg" label="Loading KekeGo" className="text-ink-900 dark:text-slate-100" />
      </div>
    )
  }
  if (status === 'authenticated') {
    return <Navigate to={homePathForRole(role)} replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <PwaUpdateBanner />
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RoleSelect /></GuestOnly>} />
      <Route path="/register/student" element={<Register />} />
      <Route path="/register/driver" element={<DriverRegister />} />

      <Route path="/home" element={<Protected><Home /></Protected>} />
      <Route path="/find" element={<Protected><FindRide /></Protected>} />
      <Route path="/create-group" element={<Protected><CreateGroup /></Protected>} />
      <Route path="/groups" element={<Protected><GroupsPage /></Protected>} />
      <Route path="/groups/:groupId" element={<Protected><GroupStatus /></Protected>} />
      <Route path="/trips" element={<Protected><TripsPage /></Protected>} />
      <Route path="/trips/:tripId" element={<Protected><TripDetail /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/wallet" element={<Protected><WalletPage /></Protected>} />
      <Route path="/driver" element={<DriverProtected><DriverHome /></DriverProtected>} />
      <Route path="/driver/requests" element={<DriverProtected><DriverRequests /></DriverProtected>} />
      <Route path="/driver/earnings" element={<DriverProtected><DriverEarnings /></DriverProtected>} />
      <Route path="/driver/profile" element={<DriverProtected><DriverProfile /></DriverProtected>} />
      <Route path="/payment/review" element={<Protected><PaymentReview /></Protected>} />
      <Route path="/payment/checkout" element={<Protected><PaymentCheckout /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}