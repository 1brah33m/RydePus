import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Pencil,
  Bell,
  HelpCircle,
  LogOut,
  Mail,
  Phone,
  BookOpen,
  Building2,
  Moon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { ThemeToggle } from '../../components/ui/ThemeToggle'

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

  const rows = [
    { icon: BookOpen, label: 'Department', value: student.department },
    { icon: Building2, label: 'Faculty', value: student.faculty },
    { icon: GraduationCap, label: 'Level', value: `${student.level} Level` },
    { icon: Mail, label: 'Email', value: student.email },
    { icon: Phone, label: 'Phone', value: student.phone },
  ]

  const actions = [
    { icon: Pencil, label: 'Edit Profile', onClick: openEdit },
    { icon: Bell, label: 'Notification Settings', onClick: () => setNotice('Notification preferences are coming soon.') },
    { icon: HelpCircle, label: 'Help & Support', onClick: () => setNotice('Our help centre is coming soon.') },
  ]

  return (
    <div className="flex min-h-full flex-col gap-5 pb-8 pt-10 lg:pt-8">
      {/* Profile header — avoids clipped text with min-w-0 + break-words */}
      <header className="flex items-center gap-4 rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-charcoal text-sm font-bold text-brand-400 dark:bg-white/10"
        >
          {nameInitials(student.fullName) || 'K'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-lg font-bold leading-snug text-ink-900 dark:text-slate-100">{student.fullName}</h1>
          <p className="mt-0.5 break-words text-sm leading-relaxed text-ink-500 dark:text-slate-400">
            {student.faculty ? `${student.faculty} · ${student.level} Level` : 'Student account'}
          </p>
        </div>
      </header>

      {notice && (
        <Alert tone={notice.includes('saved') || notice.includes('updated') ? 'success' : 'info'}>{notice}</Alert>
      )}

      <section aria-label="Profile details" className="rounded-3xl border border-ink-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E1E1E]">
        <dl className="divide-y divide-ink-100 dark:divide-white/5">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:gap-3 md:py-3">
              <dt className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">
                <row.icon aria-hidden className="size-4 shrink-0" />
                {row.label}
              </dt>
              <dd className="min-w-0 break-words text-sm font-medium leading-relaxed text-ink-800 dark:text-slate-200">
                {row.value || '—'}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Account actions" className="divide-y divide-ink-100 rounded-3xl border border-ink-200/70 bg-white shadow-sm dark:divide-white/5 dark:border-slate-800 dark:bg-[#1E1E1E]">
        {actions.map((action) => (
          <div key={action.label}>
            <button
              type="button"
              onClick={action.onClick}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm font-medium text-ink-800 hover:bg-ink-50 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <action.icon aria-hidden className="size-4.5 shrink-0 text-ink-400 dark:text-slate-500" />
              {action.label}
            </button>
            {action.label === 'Notification Settings' && (
              <div className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-sm font-medium text-ink-800 dark:text-slate-200">
                <span className="flex items-center gap-3">
                  <Moon aria-hidden className="size-4.5 shrink-0 text-ink-400 dark:text-slate-500" />
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
        <p className="text-sm text-ink-600">You will need to sign in again to use Rydepus.</p>
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