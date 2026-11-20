import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Add01Icon } from 'hugeicons-react'
import { getLocation } from '../../config/locations'
import { perSeatFare } from '../../config/pricing'
import { formatCurrency } from '../../utils/format'
import { AppHeader } from '../../components/navigation/AppHeader'
import { useApp } from '../../context/AppContext'
import { useGroupJoin } from '../../hooks/useGroupJoin'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Alert } from '../../components/ui/Alert'
import { GroupCard } from '../../components/groups/GroupCard'
import { MembershipBlockModal } from '../../components/groups/MembershipBlockModal'
import { RouteIndicator } from '../../components/shared/RouteIndicator'

export function FindRide() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { groupsByRoute, createGroup, activeGroup, leaveGroup } = useApp()
  const { joiningId, blockedGroupId, leaving, leaveBlocked, joinError, join, dismissBlock, viewActiveGroup, leaveAndJoin, dismissLeaveBlock, dismissJoinError } =
    useGroupJoin()

  const pickupId = params.get('pickup') ?? ''
  const destinationId = params.get('destination') ?? ''
  const pickup = getLocation(pickupId)
  const destination = getLocation(destinationId)
  const seats = Math.min(4, Math.max(1, Number(params.get('seats')) || 1))

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createBlocked, setCreateBlocked] = useState(false)
  const [createLeaving, setCreateLeaving] = useState(false)
  const [createLeaveBlocked, setCreateLeaveBlocked] = useState(false)

  const groups = useMemo(
    () => (pickup && destination ? groupsByRoute(pickup.id, destination.id) : []),
    [pickup, destination, groupsByRoute],
  )

  if (!pickup || !destination) {
    return <Navigate to="/home" replace />
  }

  /** Create the group straight away — route and seats are already known here. */
  const handleCreate = async () => {
    if (activeGroup) {
      setCreateBlocked(true)
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const group = await createGroup(pickup, destination, seats)
      navigate(`/groups/${group.id}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create your group. Please try again.')
      setCreating(false)
    }
  }

  /** Leave the current group, then create the new one. */
  const handleLeaveAndCreate = async () => {
    if (!activeGroup) return
    setCreateLeaving(true)
    setCreateLeaveBlocked(false)
    try {
      await leaveGroup(activeGroup.id)
      setCreateBlocked(false)
      const group = await createGroup(pickup, destination, seats)
      navigate(`/groups/${group.id}`)
    } catch {
      setCreateLeaving(false)
      setCreateLeaveBlocked(true)
    }
  }

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

          {joinError && (
            <Alert tone="error" className="mt-3">
              <div className="flex items-start justify-between gap-3">
                <span>{joinError}</span>
                <button type="button" onClick={dismissJoinError} className="shrink-0 font-semibold underline">
                  Dismiss
                </button>
              </div>
            </Alert>
          )}

          {createError && (
            <Alert tone="error" className="mt-3">
              <div className="flex items-start justify-between gap-3">
                <span>{createError}</span>
                <button
                  type="button"
                  onClick={() => setCreateError(null)}
                  className="shrink-0 font-semibold underline"
                >
                  Dismiss
                </button>
              </div>
            </Alert>
          )}

          {groups.length > 0 ? (
            <div className="mt-3 flex flex-col gap-3">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  joining={joiningId === group.id}
                  onJoin={() => join(group.id, seats)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <Add01Icon aria-hidden className="size-7 text-muted-foreground" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">No groups yet</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Be the first person going this route. Create a group and let others join you.
              </p>
            </div>
          )}
        </section>

        <Button variant="outline" size="lg" fullWidth loading={creating} onClick={handleCreate}>
          <Add01Icon aria-hidden className="size-4" />
          Create New Group
        </Button>
      </div>

      <MembershipBlockModal
        open={createBlocked}
        code={activeGroup?.code ?? ''}
        leaving={createLeaving}
        warning={createLeaveBlocked ? 'A driver is already assigned to this trip. You cannot leave the group now.' : null}
        onClose={() => {
          setCreateBlocked(false)
          setCreateLeaveBlocked(false)
        }}
        onViewGroup={() => {
          setCreateBlocked(false)
          if (activeGroup) navigate(`/groups/${activeGroup.id}`)
        }}
        onLeaveGroup={handleLeaveAndCreate}
      />

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