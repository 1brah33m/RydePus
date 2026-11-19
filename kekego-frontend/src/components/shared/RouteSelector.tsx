import { useState } from 'react'
import { ArrowUpDownIcon } from 'hugeicons-react'
import { CAMPUS_LOCATIONS } from '../../config/locations'
import type { CampusLocation } from '../../types'
import { Button } from '../ui/Button'
import { LocationDropdown } from '../ui/LocationDropdown'
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
    setPickupId(destinationId)
    setDestinationId(pickupId)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <div aria-hidden className="flex flex-col items-center pt-8">
          <span className="size-2.5 rounded-full border-2 border-primary" />
          <span className="my-1 w-px flex-1 bg-border" />
          <span className="size-2.5 rounded-[4px] bg-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-muted px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              From
            </p>
            <LocationDropdown
              ariaLabel="Pickup point"
              placeholder="Choose pickup point"
              options={LOCATION_OPTIONS}
              value={pickupId}
              onChange={(v) => {
                setPickupId(v)
                setError(null)
              }}
            />
          </div>

          <div className="mt-2.5 rounded-2xl border border-border bg-card px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              To
            </p>
            <LocationDropdown
              ariaLabel="Destination"
              placeholder="Choose destination"
              options={LOCATION_OPTIONS}
              value={destinationId}
              onChange={(v) => {
                setDestinationId(v)
                setError(null)
              }}
            />
          </div>
        </div>

        <div className="flex items-center">
          <button
            type="button"
            onClick={swap}
            aria-label="Swap pickup and destination"
            title="Swap pickup and destination"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowUpDownIcon aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        fullWidth
        size="lg"
        loading={submitting}
        disabled={!pickupId || !destinationId}
        onClick={handleSubmit}
        className="mt-1"
      >
        {submitLabel}
      </Button>
    </div>
  )
}
