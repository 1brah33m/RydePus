import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { getLocation } from '../../config/locations'
import { perSeatFare } from '../../config/pricing'
import { formatCurrency } from '../../utils/format'
import { AppHeader } from '../../components/navigation/AppHeader'
import { useApp } from '../../context/AppContext'
import { useGroupJoin } from '../../hooks/useGroupJoin'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { GroupCard } from '../../components/groups/GroupCard'
import { MembershipBlockModal } from '../../components/groups/MembershipBlockModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { RouteIndicator } from '../../components/shared/RouteIndicator'

export function FindRide() {
  const [params] = useSearchParams()
  const { groupsByRoute } = useApp()
  const { joiningId, blockedGroupId, leaving, leaveBlocked, activeGroup, join, dismissBlock, viewActiveGroup, leaveAndJoin, dismissLeaveBlock } =
    useGroupJoin()

  const pickupId = params.get('pickup') ?? ''
  const destinationId = params.get('destination') ?? ''
  const pickup = getLocation(pickupId)
  const destination = getLocation(destinationId)
  const seats = Math.min(4, Math.max(1, Number(params.get('seats')) || 1))

  const groups = useMemo(
    () => (pickup && destination ? groupsByRoute(pickup.id, destination.id) : []),
    [pickup, destination, groupsByRoute],
  )

  if (!pickup || !destination) {
    return <Navigate to="/home" replace />
  }

  const createLink = `/create-group?pickup=${encodeURIComponent(pickup.id)}&destination=${encodeURIComponent(destination.id)}&seats=${seats}`

  return (
    <>
      <AppHeader title="Find a ride" />
      <div className="flex flex-col gap-5 pb-10 pt-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-slate-500">Route</p>
          <RouteIndicator pickup={pickup} destination={destination} className="mt-1.5" />
          <p className="mt-2.5 text-xs text-ink-500 dark:text-slate-400">
            Travelling for <strong className="text-ink-700 dark:text-slate-300">{seats} seat{seats > 1 ? 's' : ''}</strong>{' '}
            · about {formatCurrency(perSeatFare(pickup.id, destination.id) * seats)}
          </p>
        </Card>

        <section aria-label="Matching groups">
          <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">
            {groups.length > 0 ? `${groups.length} group${groups.length > 1 ? 's' : ''} on this route` : 'Matching groups'}
          </h2>

          {groups.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  joining={joiningId === group.id}
                  onJoin={() => join(group.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <EmptyState
                icon={Plus}
                title="No groups yet"
                description="Be the first person going this route. Create a group and let others join you."
                action={
                  <Button to={createLink} variant="primary">
                    <Plus aria-hidden className="size-4" />
                    Create New Group
                  </Button>
                }
              />
            </div>
          )}
        </section>

        <Button to={createLink} variant="outline" size="lg" fullWidth>
          <Plus aria-hidden className="size-4" />
          Create New Group
        </Button>
      </div>

      <MembershipBlockModal
        open={blockedGroupId !== null}
        code={activeGroup?.code ?? ''}
        leaving={leaving}
        warning={leaveBlocked ? 'A driver is already assigned to this trip. You cannot leave the group now.' : null}
        onClose={() => {
          dismissBlock()
          dismissLeaveBlock()
        }}
        onViewGroup={viewActiveGroup}
        onLeaveGroup={leaveAndJoin}
      />
    </>
  )
}