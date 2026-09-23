import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Car,
  HelpCircle,
  LogOut,
  Mail,
  Moon,
  Phone,
  Star,
  Truck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { MOCK_DRIVERS } from '../../mock/data'
import { DriverShell } from '../../components/navigation/DriverShell'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ThemeToggle } from '../../components/ui/ThemeToggle'

const DRIVER = MOCK_DRIVERS[2]

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
  const { student, logout } = useAuth()
  const navigate = useNavigate()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (!student) {
    return null
  }

  const rows = [
    { icon: Truck, label: 'Plate Number', value: DRIVER.plateNumber },
    { icon: Car, label: 'Keke ID', value: DRIVER.kekeIdentifier },
    { icon: Mail, label: 'Email', value: student.email },
    { icon: Phone, label: 'Phone', value: student.phone || DRIVER.phone },
  ]

  const actions = [
    { icon: BadgeCheck, label: 'Permit & Verification', onClick: () => setNotice('Vehicle permit verified. Epe campus zone approved.') },
    { icon: HelpCircle, label: 'Help & Support', onClick: () => setNotice('Our help centre is coming soon.') },
  ]

  return (
    <DriverShell>
      <div className="flex min-h-full flex-col gap-6 pb-36 pt-10 lg:pb-10 lg:pt-8">
        {/* Profile header */}
        <header className="flex items-center gap-4 rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
          >
            {nameInitials(student.fullName) || 'K'}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-lg font-bold leading-snug dark:text-slate-100">{student.fullName}</h1>
            <p className="mt-0.5 break-words text-sm leading-relaxed text-ink-500 dark:text-slate-400">
              {DRIVER.plateNumber} · {DRIVER.kekeIdentifier}
            </p>
          </div>
        </header>

        {/* Driver stats */}
        <section aria-label="Driver statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-slate-400">
              <Star aria-hidden className="size-3.5 text-brand-600 dark:text-brand-400" />
              Rating
            </span>
            <p className="mt-1.5 text-2xl font-bold">{DRIVER.rating.toFixed(1)}</p>
          </div>
          <div className="rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-slate-400">
              <Car aria-hidden className="size-3.5 text-brand-600 dark:text-brand-400" />
              Total trips
            </span>
            <p className="mt-1.5 text-2xl font-bold">{DRIVER.totalTrips}</p>
          </div>
        </section>

        {notice && (
          <p role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            {notice}
          </p>
        )}

        {/* Details */}
        <section aria-label="Driver details" className="rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
          <dl className="divide-y divide-ink-100 dark:divide-white/5">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:gap-3 md:py-3"
              >
                <dt className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">
                  <row.icon aria-hidden className="size-4 shrink-0 text-ink-400 dark:text-slate-400" />
                  {row.label}
                </dt>
                <dd className="min-w-0 break-words text-sm font-medium leading-relaxed text-ink-800 dark:text-slate-200">
                  {row.value || '—'}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Actions */}
        <section aria-label="Account actions" className="divide-y divide-ink-100 overflow-hidden rounded-3xl border border-ink-200/70 bg-white shadow-sm dark:divide-white/5 dark:border-slate-800 dark:bg-[#1E1E1E]">
          {actions.map((action) => (
            <div key={action.label}>
              <button
                type="button"
                onClick={action.onClick}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium text-ink-800 hover:bg-ink-50 dark:text-slate-200 dark:hover:bg-white/5"
              >
                <action.icon aria-hidden className="size-4.5 shrink-0 text-brand-600 dark:text-brand-400" />
                {action.label}
              </button>
              {action.label === 'Help & Support' && (
                <div className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-sm font-medium text-ink-800 dark:text-slate-200">
                  <span className="flex items-center gap-3">
                    <Moon aria-hidden className="size-4.5 shrink-0 text-brand-600 dark:text-brand-400" />
                    Dark Mode
                  </span>
                  <ThemeToggle />
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
          >
            <LogOut aria-hidden className="size-4.5 shrink-0" />
            Logout
          </button>
        </section>

        <p className="pb-2 text-center text-xs text-ink-400 dark:text-slate-500">Rydepus · Campus Shuttle (MVP)</p>
      </div>

      {/* Logout confirm modal */}
      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} title="Log out?">
        <p className="text-sm text-ink-600">You will need to sign in again to use Rydepus.</p>
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