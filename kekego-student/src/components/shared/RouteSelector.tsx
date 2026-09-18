import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { CAMPUS_LOCATIONS } from '../../mock/data'
import type { CampusLocation } from '../../types'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import type { SelectOption } from '../ui/Select'

const LOCATION_OPTIONS: SelectOption[] = CAMPUS_LOCATIONS.map((l) => ({
  value: l.id,
  label: l.name,
}))

interface RouteSelectorProps {
  defaultPickupId?: string
  defaultDestinationId?: string
  submitting?: boolean
  submitLabel?: string
  onSubmit: (pickup: CampusLocation, destination: CampusLocation) => void
}

export function RouteSelector({
  defaultPickupId,
  defaultDestinationId,
  submitting = false,
  submitLabel = 'Find a Ride',
  onSubmit,
}: RouteSelectorProps) {
  const [pickupId, setPickupId] = useState(defaultPickupId ?? '')
  const [destinationId, setDestinationId] = useState(defaultDestinationId ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!pickupId || !destinationId) {
      setError('Please choose both your pickup point and destination.')
      return
    }
    if (pickupId === destinationId) {
      setError('Pickup and destination must be different.')
      return
    }
    setError(null)
    const pickup = CAMPUS_LOCATIONS.find((l) => l.id === pickupId)!
    const destination = CAMPUS_LOCATIONS.find((l) => l.id === destinationId)!
    onSubmit(pickup, destination)
  }

  const swap = () => {
    const p = pickupId
    setPickupId(destinationId)
    setDestinationId(p)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <Select
        label="From"
        aria-label="Pickup point"
        options={LOCATION_OPTIONS}
        placeholder="Choose pickup point"
        value={pickupId}
        onChange={(e) => {
          setPickupId(e.target.value)
          setError(null)
        }}
      />
      <div className="flex items-center justify-center gap-2 text-xs font-medium text-ink-400 dark:text-slate-500">
        <MapPin aria-hidden className="size-4" />
        <span>Pickup → Destination</span>
        <button
          type="button"
          onClick={swap}
          className="ml-1 rounded-md px-1.5 py-0.5 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
        >
          Swap
        </button>
      </div>
      <Select
        label="To"
        aria-label="Destination"
        options={LOCATION_OPTIONS}
        placeholder="Choose destination"
        value={destinationId}
        onChange={(e) => {
          setDestinationId(e.target.value)
          setError(null)
        }}
      />
      {error && (
        <p role="alert" className="mt-1 text-sm text-rose-600">
          {error}
        </p>
      )}
      <Button
        fullWidth
        size="lg"
        loading={submitting}
        disabled={!pickupId || !destinationId}
        onClick={handleSubmit}
        className="mt-2"
      >
        {submitLabel}
      </Button>
    </div>
  )
}