import { Users } from 'lucide-react'
import type { Group } from '../../types'
import { timeAgo } from '../../utils/format'
import { groupSeatCount } from '../../services/mockBackend'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { RouteIndicator } from '../shared/RouteIndicator'

interface GroupCardProps {
  group: Group
  onJoin?: () => void
  joining?: boolean
}

export function GroupCard({ group, onJoin, joining = false }: GroupCardProps) {
  const occupied = groupSeatCount(group)
  const waiting = group.maxSize - occupied
  const joinable = group.status === 'WAITING'

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <RouteIndicator pickup={group.pickup} destination={group.destination} />
        <GroupStatusMark status={group.status} />
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-ink-600 dark:text-slate-400">
        <Users aria-hidden className="size-4 text-ink-400 dark:text-slate-500" />
        <span className="font-medium text-ink-800 dark:text-slate-200">
          {occupied}/{group.maxSize} passengers
        </span>
        <span aria-hidden className="text-ink-300 dark:text-slate-600">
          ·
        </span>
        <span className="text-ink-400 dark:text-slate-500">{timeAgo(group.createdAt)}</span>
      </div>

      <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">
        {joinable
          ? `Waiting for ${waiting} more passenger${waiting === 1 ? '' : 's'}`
          : group.status === 'FULL'
            ? 'Group is full — ready for a driver'
            : 'Group sent to driver queue'}
      </p>

      {joinable && (
        <Button
          size="sm"
          fullWidth
          className="mt-3.5"
          onClick={onJoin}
          loading={joining}
          disabled={joining}
        >
          {joining ? 'JOINING…' : 'JOIN GROUP'}
        </Button>
      )}
    </Card>
  )
}

function GroupStatusMark({ status }: { status: Group['status'] }) {
  if (status === 'WAITING') {
    return <Badge tone="amber" dot>Waiting</Badge>
  }
  if (status === 'FULL') {
    return <Badge tone="blue" dot>Full</Badge>
  }
  if (status === 'SEARCHING_DRIVER') {
    return <Badge tone="violet" dot className="animate-pulse">Finding driver</Badge>
  }
  return <Badge tone="ink">Closed</Badge>
}