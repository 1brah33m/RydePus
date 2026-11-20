import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight01Icon,
  BookOpen01Icon,
  Building02Icon,
  Call02Icon,
  CheckmarkBadge01Icon,
  GraduationScrollIcon,
  HelpCircleIcon,
  Logout01Icon,
  Mail01Icon,
  Moon01Icon,
  Notification01Icon,
  PencilIcon,
} from 'hugeicons-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { ThemeToggle } from '../../components/ui/ThemeToggle'
import { cn } from '../../utils/cn'

const LEVELS = [100, 200, 300, 400, 500, 600, 700].map((n) => ({
  value: String(n),
  label: `${n} Level`,
}))

function nameInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Profile() {
  const { student, updateStudent, logout } = useAuth()
  const { state } = useApp()
  const navigate = useNavigate()

  const [editOpen, setEditOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ fullName: '', department: '', faculty: '', level: '', phone: '' })

  if (!student) {
    return null
  }

  const openEdit = () => {
    setForm({
      fullName: student.fullName,
      department: student.department,
      faculty: student.faculty,
      level: student.level,
      phone: student.phone,
    })
    setNotice(null)
    setEditOpen(true)
  }

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim()) return
    setSaving(true)
    try {
      await updateStudent({
        fullName: form.fullName.trim(),
        department: form.department.trim(),
        faculty: form.faculty.trim(),
        level: form.level,
        phone: form.phone.trim(),
      })
      setEditOpen(false)
      setNotice('Profile updated.')
    } catch {
      setNotice('Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  // ---- Derived data (same language as Trips / Groups pages) ----
  const totalTrips = state.trips.length
  const completedTrips = state.trips.filter((t) => t.status === 'COMPLETED').length

  const detailRows = [
    { icon: BookOpen01Icon, label: 'Department', value: student.department },
    { icon: Building02Icon, label: 'Faculty', value: student.faculty },
    { icon: GraduationScrollIcon, label: 'Level', value: student.level ? `${student.level} Level` : '' },
    { icon: Mail01Icon, label: 'Email', value: student.email },
    { icon: Call02Icon, label: 'Phone', value: student.phone },
  ]

  return (
    <div className="flex min-h-full flex-col gap-5 pb-8 pt-10 lg:pt-8">
      {/* Header — same pattern as Trips / Groups */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your campus identity.</p>
        </div>
        <Button variant="outline" size="sm" onClick={openEdit} className="shrink-0">
          <PencilIcon aria-hidden className="size-4" />
          Edit
        </Button>
      </header>

      {notice && (
        <Alert tone={notice.includes('updated') ? 'success' : 'info'}>{notice}</Alert>
      )}

      {/* Identity hero — borrows the Trips active-trip hero + Home booking card */}
      <section
        aria-label="Identity"
        className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-md sm:p-6"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider">Student account</p>
          {student.level && (
            <span className="ml-auto inline-flex items-center rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums">
              {student.level} Level
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-lg font-bold"
          >
            {nameInitials(student.fullName) || 'K'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-xl font-bold tracking-tight">{student.fullName}</span>
              <CheckmarkBadge01Icon aria-label="Verified student" className="size-5 shrink-0 opacity-80" />
            </p>
            <p className="mt-0.5 truncate text-sm opacity-80">
              {[student.faculty, student.department].filter(Boolean).join(' · ') || 'Campus rider'}
            </p>
            <p className="mt-1 truncate font-mono text-[13px] tabular-nums opacity-70">{student.email}</p>
          </div>
        </div>

      </section>

      {/* Stats — borrows DriverProfile stats grid, in project tokens */}
      <section aria-label="Ride stats" className="grid grid-cols-3 gap-3">
        <Card className="min-w-0 p-4">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rides</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{totalTrips}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">total trips</p>
        </Card>
        <Card className="min-w-0 p-4">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Done</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{completedTrips}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">completed</p>
        </Card>
        <Card className="min-w-0 p-4">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Level</p>
          <p className="mt-1.5 truncate text-2xl font-bold text-foreground">{student.level || '—'}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{student.faculty || 'faculty'}</p>
        </Card>
      </section>

      {/* Student details — borrows Wallet "How you pay" list + icon tiles from Groups */}
      <Card className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student details</p>
        <dl className="mt-1 divide-y divide-border">
          {detailRows.map((row) => (
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

      {/* Settings — borrows TripCard row affordance, fixes Dark Mode nesting */}
      <section aria-label="Settings">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Settings</h2>
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-border">
            <button
              type="button"
              onClick={openEdit}
              className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-background">
                <PencilIcon aria-hidden className="size-4.5 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Edit Profile</span>
              <ArrowRight01Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => setNotice('Notification preferences are coming soon.')}
              className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-background">
                <Notification01Icon aria-hidden className="size-4.5 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Notification Settings</span>
              <Badge tone="amber" className="shrink-0">
                Soon
              </Badge>
              <ArrowRight01Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
            <div className="flex w-full items-center gap-3 px-5 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Moon01Icon aria-hidden className="size-4.5 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Dark Mode</span>
              <ThemeToggle />
            </div>
            <button
              type="button"
              onClick={() => setNotice('Our help centre is coming soon.')}
              className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-background">
                <HelpCircleIcon aria-hidden className="size-4.5 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Help &amp; Support</span>
              <ArrowRight01Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
        </Card>
      </section>

      <Button variant="danger" size="lg" fullWidth onClick={() => setConfirmLogout(true)} className={cn('mt-1')}>
        <Logout01Icon aria-hidden className="size-5" />
        Log Out
      </Button>

      <p className="pb-2 text-center text-xs text-muted-foreground">Rydepus · Campus Shuttle (MVP)</p>

      {/* Edit profile modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <form onSubmit={saveProfile} className="space-y-4">
          <Input
            label="Full name"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            required
          />
          <Input
            label="Department"
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
          />
          <Input
            label="Faculty"
            value={form.faculty}
            onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))}
          />
          <Select
            label="Level"
            options={LEVELS}
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
          />
          <Input
            label="Phone number"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" fullWidth onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" fullWidth loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Logout confirm modal */}
      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} title="Log out?">
        <p className="text-sm text-muted-foreground">You will need to sign in again to use Rydepus.</p>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" fullWidth onClick={() => setConfirmLogout(false)}>
            Stay
          </Button>
          <Button variant="danger" fullWidth onClick={handleLogout}>
            Log Out
          </Button>
        </div>
      </Modal>
    </div>
  )
}
