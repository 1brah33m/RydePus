import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckmarkBadge01Icon, Car01Icon, HelpCircleIcon, Logout01Icon, Mail01Icon, Moon01Icon, Call02Icon, StarIcon } from 'hugeicons-react'
import { useAuth } from '../../context/AuthContext'
import { useDriverRide } from '../../hooks/useDriverRide'
import { DriverShell } from '../../components/navigation/DriverShell'
import { PayoutDetailsCard } from '../../components/driver/PayoutDetailsCard'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Alert } from '../../components/ui/Alert'
import { ThemeToggle } from '../../components/ui/ThemeToggle'
import { cn } from '../../utils/cn'

function nameInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function DriverProfile() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { profile, history, savePayoutDetails } = useDriverRide()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const fullName = profile?.full_name ?? 'Driver'
  const statusText =
    profile?.availability_status === 'ONLINE'
      ? 'Online'
      : profile?.availability_status === 'BUSY'
        ? 'On a ride'
        : 'Offline'
  const isAway = statusText === 'Offline'

  // Fall back through the fields a driver may actually have: a vehicle name or
  // type, otherwise the plate number, otherwise a sensible default.
  const vehicleLabel = profile?.vehicle_type || profile?.vehicle_plate || 'Keke'
  const ratingLabel = profile?.rating != null ? profile.rating.toFixed(1) : 'New'

  const rows = [
    { icon: Car01Icon, label: 'Vehicle', value: vehicleLabel },
    { icon: CheckmarkBadge01Icon, label: 'Plate Number', value: profile?.vehicle_plate },
    { icon: CheckmarkBadge01Icon, label: 'License Number', value: profile?.license_number },
    { icon: Mail01Icon, label: 'Email', value: profile?.email },
    { icon: Call02Icon, label: 'Phone', value: profile?.phone_number },
  ]

  return (
    <DriverShell>
      <div className="flex min-h-full flex-col gap-5 pb-36 pt-10 lg:pb-10 lg:pt-8">
        {/* Header — same pattern as the student Profile */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your driver identity.</p>
          </div>
        </header>

        {/* Identity hero — borrows the student identity hero */}
        <section
          aria-label="Identity"
          className="rounded-3xl bg-primary p-5 text-primary-foreground sm:p-6"
        >
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-xs font-bold uppercase tracking-wider">Driver account</p>
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums">
              {!isAway && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-current" />}
              {statusText}
            </span>
          </div>

          <div className="mt-4 flex min-w-0 items-center gap-4">
            <span
              aria-hidden
              className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-lg font-bold"
            >
              {nameInitials(fullName) || 'D'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-xl font-bold tracking-tight">{fullName}</span>
                <CheckmarkBadge01Icon aria-label="Verified driver" className="size-5 shrink-0 opacity-80" />
              </p>
              <p className="mt-0.5 truncate text-sm opacity-80">
                {[profile?.vehicle_plate, profile?.vehicle_type].filter(Boolean).join(' · ') || 'Campus driver'}
              </p>
              {profile?.email && (
                <p className="mt-1 truncate font-mono text-[13px] tabular-nums opacity-70">{profile.email}</p>
              )}
            </div>
          </div>
        </section>

        {/* Stats — same grid as the student Profile */}
        <section aria-label="Driver stats" className="grid grid-cols-3 gap-3">
          <Card className="min-w-0 p-4">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-2xl font-bold text-foreground">
              {!isAway && <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />}
              <span className="truncate">{statusText}</span>
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {profile?.availability_status === 'BUSY' ? 'ride active' : 'availability'}
            </p>
          </Card>
          <Card className="min-w-0 p-4">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Trips</p>
            <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{history.length}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">total trips</p>
          </Card>
          <Card className="min-w-0 p-4">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rating</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-2xl font-bold text-foreground">
              <StarIcon aria-hidden className="size-5 shrink-0 fill-amber-400 text-amber-400" />
              <span className="truncate tabular-nums">{ratingLabel}</span>
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {profile && profile.rating_count > 0 ? `${profile.rating_count} reviews` : 'no reviews yet'}
            </p>
          </Card>
        </section>

        {notice && (
          <Alert tone="info" className="break-words">{notice}</Alert>
        )}

        {/* Driver details — same list as the student details card */}
        <Card className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Driver details</p>
          <dl className="mt-1 divide-y divide-border">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3 py-3.5 last:pb-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <row.icon aria-hidden className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd className="mt-0.5 min-w-0 break-words text-sm font-semibold leading-relaxed text-foreground">
                    {row.value || '—'}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </Card>

        {/* Payout account */}
        <section aria-label="Payout account">
          <PayoutDetailsCard
            initial={{
              bank_name: profile?.bank_name,
              account_number: profile?.account_number,
              account_name: profile?.account_name,
            }}
            hasPayoutDetails={profile?.has_payout_details ?? false}
            onSave={savePayoutDetails}
          />
        </section>

        {/* Settings — same row affordance as the student Profile */}
        <section aria-label="Settings">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Settings</h2>
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-border">
              <button
                type="button"
                onClick={() => setNotice('Vehicle permit verified. Epe campus zone approved.')}
                className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-background">
                  <CheckmarkBadge01Icon aria-hidden className="size-4.5 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Permit &amp; Verification</span>
              </button>
              <button
                type="button"
                onClick={() => setNotice('Our help centre is coming soon.')}
                className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-background">
                  <HelpCircleIcon aria-hidden className="size-4.5 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Help &amp; Support</span>
              </button>
              <div className="flex w-full items-center gap-3 px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Moon01Icon aria-hidden className="size-4.5 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Dark Mode</span>
                <ThemeToggle />
              </div>
            </div>
          </Card>
        </section>

        <Button variant="danger" size="lg" fullWidth onClick={() => setConfirmLogout(true)} className={cn('mt-1')}>
          <Logout01Icon aria-hidden className="size-5" />
          Log Out
        </Button>

        <p className="pb-2 text-center text-xs text-muted-foreground">Rydepus · Campus Shuttle (MVP)</p>
      </div>

      {/* Logout confirm modal */}
      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} title="Log out?">
        <p className="text-sm text-muted-foreground">You will need to sign in again to use Rydepus.</p>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" fullWidth onClick={() => setConfirmLogout(false)}>
            Stay
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              logout()
              navigate('/', { replace: true })
            }}
          >
            Log Out
          </Button>
        </div>
      </Modal>
    </DriverShell>
  )
}
