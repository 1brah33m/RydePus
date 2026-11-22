import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock01Icon, Add01Icon, UserGroupIcon, User02Icon } from 'hugeicons-react'
import { useApp } from '../../context/AppContext'
import { useGroupJoin } from '../../hooks/useGroupJoin'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { MembershipBlockModal } from '../../components/groups/MembershipBlockModal'
import { cn } from '../../utils/cn'
import { formatCurrency } from '../../utils/format'
import type { Group } from '../../types'

type Filter = 'all' | 'open' | 'full'

/** Minutes until the group departs. Newly created groups default to +15 min from creation. */
function minutesToDeparture(group: Group): number {
  const created = new Date(group.createdAt).getTime()
  const departure = group.departsAt ? new Date(group.departsAt).getTime() : created + 15 * 60_000
  return Math.max(0, Math.round((departure - Date.now()) / 60_000))
}

function driverLabel(status: string): string {
  if (status === 'SEARCHING_DRIVER') return 'Finding Driver'
  return 'Pending Driver'
}

function isOpenGroup(status: string, occupied: number, maxSize: number): boolean {
  return status === 'WAITING' && occupied < maxSize
}

export function GroupsPage() {
  const { activeGroup, allPendingGroups } = useApp()
  const { joiningId, blockedGroupId, leaving, leaveBlocked, leaveError, joinError, join, dismissBlock, viewActiveGroup, leaveAndJoin, dismissLeaveBlock, dismissLeaveError, dismissJoinError } =
    useGroupJoin()

  const [filter, setFilter] = useState<Filter>('all')

  // Refresh the live departure countdowns every 30s.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const counts = useMemo(() => {
    let open = 0
    for (const g of allPendingGroups) {
      if (isOpenGroup(g.status, g.seatsFilled, g.maxSize)) open += 1
    }
    return { all: allPendingGroups.length, open, full: allPendingGroups.length - open }
  }, [allPendingGroups])

  const visibleGroups = useMemo(() => {
    if (filter === 'open') {
      return allPendingGroups.filter((g) => isOpenGroup(g.status, g.seatsFilled, g.maxSize))
    }
    if (filter === 'full') {
      return allPendingGroups.filter((g) => !isOpenGroup(g.status, g.seatsFilled, g.maxSize))
    }
    return allPendingGroups
  }, [allPendingGroups, filter])

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'open', label: 'Open seats', count: counts.open },
    { id: 'full', label: 'Full', count: counts.full },
  ]

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-5 pb-10 pt-10 lg:pt-8">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">Join a group heading your way.</p>
        </div>
        <Link
          to="/create-group"
          aria-label="Create new group"
          title="Create new group"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:scale-[0.97]"
        >
          <Add01Icon aria-hidden className="size-5" />
        </Link>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter groups">
        {filters.map((f) => {
          const active = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {f.label}
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-bold',
                  active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {f.count}
              </span>
            </button>
          )
        })}
      </div>

      {activeGroup && (
        <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <UserGroupIcon aria-hidden className="size-5" />
            <span className="sr-only">Your group</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">
              {activeGroup.pickup.name} → {activeGroup.destination.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeGroup.seatsFilled}/{activeGroup.maxSize} passengers · You're in this group
            </p>
          </div>
          <Button size="sm" to={`/groups/${activeGroup.id}`}>
            Open
          </Button>
        </div>
      )}

      <section aria-label="Groups" className="min-w-0">
        {joinError && (
          <Alert tone="error" className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <span>{joinError}</span>
              <button type="button" onClick={dismissJoinError} className="shrink-0 font-semibold underline">
                Dismiss
              </button>
            </div>
          </Alert>
        )}
        {leaveError && (
          <Alert tone="error" className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <span>{leaveError}</span>
              <button type="button" onClick={dismissLeaveError} className="shrink-0 font-semibold underline">
                Dismiss
              </button>
            </div>
          </Alert>
        )}
        {visibleGroups.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            {visibleGroups.map((group) => (
              <GroupCard key={group.id} group={group} joining={joiningId === group.id} onJoin={() => join(group.id)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <UserGroupIcon aria-hidden className="size-7 text-muted-foreground" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {filter === 'all' ? 'No groups are waiting right now' : filter === 'open' ? 'No open seats right now' : 'No full groups right now'}
            </h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {filter === 'all'
                ? 'Everyone is moving fast! Start a group for your route and others will join.'
                : 'Try a different filter, or start your own group.'}
            </p>
            <Button to="/create-group" className="mt-5">
              Start New Group
            </Button>
          </div>
        )}
      </section>

      <Button to="/create-group" variant="outline" size="lg" fullWidth className="mt-1">
        <Add01Icon aria-hidden className="size-5" />
        Start New Group
      </Button>

      <MembershipBlockModal
        open={blockedGroupId !== null}
        code={activeGroup?.code ?? ''}
        leaving={leaving}
        warning={leaveBlocked ? 'A driver is already assigned to this trip. You cannot leave the group now.' : null}
        onClose={() => {
          dismissBlock()
          dismissLeaveBlock()
          dismissLeaveError()
        }}
        onViewGroup={viewActiveGroup}
        onLeaveGroup={leaveAndJoin}
      />
    </div>
  )
}

function GroupCard({
  group,
  joining,
  onJoin,
}: {
  group: Group
  joining: boolean
  onJoin: () => void
}) {
  const occupied = group.seatsFilled
  const mins = minutesToDeparture(group)
  // A member looking at their own group must see a way back in, not a Join
  // button that the server would reject with "already joined".
  const isMember = group.members.some((m) => m.isCurrentUser)
  const joinable = !isMember && isOpenGroup(group.status, occupied, group.maxSize)
  const leavingSoon = mins < 1

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card p-5 transition-colors hover:border-ring">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <div aria-hidden className="flex shrink-0 flex-col items-center pt-1.5">
            <span className="size-2 rounded-full border-2 border-primary" />
            <span className="my-1 w-px flex-1 bg-border" />
            <span className="size-2 rounded-[3px] bg-foreground" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-[15px] font-bold text-foreground">{group.pickup.name}</p>
            <p className="mt-1.5 truncate text-[15px] font-bold text-foreground">{group.destination.name}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold tracking-tight whitespace-nowrap text-foreground">{formatCurrency(group.fareTotal)}</p>
          <p className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">per keke</p>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {leavingSoon ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Clock01Icon aria-hidden className="size-3.5" />
            Leaving soon
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <Clock01Icon aria-hidden className="size-3.5" />
            Leaving in: {mins} min{mins === 1 ? '' : 's'}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" />
          {driverLabel(group.status)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex shrink-0 -space-x-2" aria-hidden>
            {Array.from({ length: group.maxSize }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border ring-2 ring-card',
                  i < occupied
                    ? 'border-border bg-muted text-foreground'
                    : 'border-dashed border-border text-muted-foreground',
                )}
              >
                <User02Icon className="size-3" />
              </span>
            ))}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {occupied} of {group.maxSize} joined
          </span>
        </div>

        {joinable ? (
          <button
            type="button"
            onClick={onJoin}
            disabled={joining}
            className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
          >
            {joining ? 'Joining…' : 'Join group'}
          </button>
        ) : isMember ? (
          <Button size="sm" to={`/groups/${group.id}`} className="shrink-0 px-5">
            Open
          </Button>
        ) : (
          <span className="shrink-0 rounded-xl bg-muted px-5 py-2.5 text-sm font-semibold text-muted-foreground">
            Full
          </span>
        )}
      </div>
    </div>
  )
}
