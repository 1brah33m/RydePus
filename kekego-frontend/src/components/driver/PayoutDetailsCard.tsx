import { useState } from 'react'
import { Building2, Check, Pencil } from 'lucide-react'
import type { PayoutDetails } from '../../services/driverService'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'

interface PayoutDetailsCardProps {
  initial?: Partial<PayoutDetails>
  hasPayoutDetails: boolean
  onSave: (details: PayoutDetails) => Promise<void>
}

function SavedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="break-words text-sm font-semibold text-ink-900 dark:text-slate-100">{value}</dd>
    </div>
  )
}

export function PayoutDetailsCard({ initial, hasPayoutDetails, onSave }: PayoutDetailsCardProps) {
  // The saved values are the source of truth for the summary; the local state
  // backs the editable form and is reset from them whenever editing reopens.
  const savedBankName = initial?.bank_name ?? ''
  const savedAccountNumber = initial?.account_number ?? ''
  const savedAccountName = initial?.account_name ?? ''

  const [bankName, setBankName] = useState(savedBankName)
  const [accountNumber, setAccountNumber] = useState(savedAccountNumber)
  const [accountName, setAccountName] = useState(savedAccountName)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const startEditing = () => {
    setBankName(savedBankName)
    setAccountNumber(savedAccountNumber)
    setAccountName(savedAccountName)
    setError(null)
    setSaved(false)
    setEditing(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({ bank_name: bankName, account_number: accountNumber, account_name: accountName })
      setSaved(true)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save your payout details. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <Building2 aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Payout account</h2>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">
            {hasPayoutDetails
              ? 'Students transfer fares directly to this account.'
              : 'The bank account students transfer fares to.'}
          </p>
        </div>
      </div>

      {saved && hasPayoutDetails && (
        <Alert tone="success" className="mt-4">
          Payout details saved.
        </Alert>
      )}

      {hasPayoutDetails && !editing ? (
        <>
          <dl className="mt-4 divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 dark:divide-white/5 dark:border-slate-800">
            <SavedField label="Bank name" value={savedBankName} />
            <SavedField label="Account number" value={savedAccountNumber} />
            <SavedField label="Account name" value={savedAccountName} />
          </dl>
          <Button type="button" variant="outline" size="lg" fullWidth className="mt-4" onClick={startEditing}>
            <Pencil aria-hidden className="size-4" />
            Edit Bank Details
          </Button>
        </>
      ) : (
        <form className="mt-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <Input
              label="Bank name"
              placeholder="e.g. GTBank"
              value={bankName}
              required
              autoComplete="off"
              onChange={(e) => setBankName(e.target.value)}
            />
            <Input
              label="Account number"
              placeholder="10 digits"
              inputMode="numeric"
              value={accountNumber}
              required
              autoComplete="off"
              onChange={(e) => setAccountNumber(e.target.value)}
            />
            <Input
              label="Account name"
              placeholder="Name on the account"
              value={accountName}
              required
              autoComplete="off"
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>

          {error && (
            <Alert tone="error" className="mt-4">
              {error}
            </Alert>
          )}

          <Button type="submit" size="lg" fullWidth loading={busy} className="mt-4">
            <Check aria-hidden className="size-4" />
            {hasPayoutDetails ? 'Update payout account' : 'Save payout account'}
          </Button>

          {hasPayoutDetails && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              fullWidth
              className="mt-2"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          )}
        </form>
      )}
    </Card>
  )
}
