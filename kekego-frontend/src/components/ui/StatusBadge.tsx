import { cn } from '../../utils/cn'
import { Badge } from './Badge'
import type { GroupStatus, TripStatus } from '../../types'

const GROUP_LABELS: Record<GroupStatus, string> = {
  WAITING: 'Waiting',
  FULL: 'Full',
  SEARCHING_DRIVER: 'Finding driver',
  DRIVER_ASSIGNED: 'Driver found',
  DRIVER_ACCEPTED: 'Driver accepted',
  IN_TRIP: 'On the way',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const TRIP_LABELS: Record<TripStatus, string> = {
  PENDING: 'Pending',
  DRIVER_ASSIGNED: 'Driver found',
  DRIVER_ACCEPTED: 'Driver accepted',
  IN_PROGRESS: 'On the way',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

function groupTone(status: GroupStatus): 'amber' | 'teal' | 'blue' | 'violet' | 'green' | 'rose' | 'ink' {
  switch (status) {
    case 'WAITING':
      return 'amber'
    case 'FULL':
    case 'SEARCHING_DRIVER':
      return 'violet'
    case 'DRIVER_ASSIGNED':
    case 'DRIVER_ACCEPTED':
    case 'IN_TRIP':
      return 'teal'
    case 'COMPLETED':
      return 'green'
    case 'CANCELLED':
      return 'rose'
  }
}

function tripTone(status: TripStatus): 'teal' | 'green' | 'rose' {
  if (status === 'COMPLETED') return 'green'
  if (status === 'CANCELLED') return 'rose'
  return 'teal'
}

export function GroupStatusBadge({ status, className }: { status: GroupStatus; className?: string }) {
  const searching = status === 'SEARCHING_DRIVER'
  return (
    <Badge tone={groupTone(status)} dot className={cn(searching && 'animate-pulse', className)}>
      {GROUP_LABELS[status]}
    </Badge>
  )
}

export function TripStatusBadge({ status, className }: { status: TripStatus; className?: string }) {
  return (
    <Badge tone={tripTone(status)} dot className={className}>
      {TRIP_LABELS[status]}
    </Badge>
  )
}