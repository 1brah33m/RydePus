import { useState } from 'react'
import { Building2, Check } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Alert } from '../ui/Alert'
import type { PayoutDetails } from '../../services/driverService'

/**
 * Where students send a direct bank transfer for their fare.
 *
 * Until this is saved, the student payment page hides the "Direct bank
 * transfer" option and offers cash only.
 */

interface PayoutDetailsCardProps {
  initial?: Partial<PayoutDetails>
  hasPayoutDetails: boolean
  onSave: (details: PayoutDetails) => Promise<void>
}

export function PayoutDetailsCard({ initial, hasPayoutDetails, onSave }: PayoutDetailsCardProps) {
  const [bankName, setBankName] = useState(initial?.bank_name ?? '')
  const [accountNumber, setAccountNumber] = useState(initial?.account_number ?? '')
  const [accountName, setAccountName] = useState(initial?.account_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await onSave({ bank_name: bankName.trim(), account_number: accountNumber.trim(), account_name: accountName.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
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
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Payout account</h2>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">
            {hasPayoutDetails
              ? 'Students see these details to pay you by direct transfer.'
              : 'Add your bank account so students can pay by direct transfer.'}
          </p>
        </div>
      </div>

      <form className="mt-4 flex flex-col gap-3.5" onSubmit={(e) => void handleSubmit(e)}>
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

        {error && <Alert tone="error">{error}</Alert>}
        {saved && (
          <Alert tone="success" className="!mt-0">
            Payout details saved.
          </Alert>
        )}

        <Button type="submit" size="lg" fullWidth loading={busy}>
          <Check aria-hidden className="size-4" />
          {hasPayoutDetails ? 'Update payout account' : 'Save payout account'}
        </Button>
      </form>
    </Card>
  )
}
