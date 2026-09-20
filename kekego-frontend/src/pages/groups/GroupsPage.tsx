import { useEffect, useState } from 'react'
import { Clock, Plus, Users, ArrowRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useGroupJoin } from '../../hooks/useGroupJoin'
import { groupSeatCount } from '../../services/mockBackend'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { MembershipBlockModal } from '../../components/groups/MembershipBlockModal'
import { RouteIndicator } from '../../components/shared/RouteIndicator'
import { cn } from '../../utils/cn'
import type { Group, GroupMember } from '../../types'

const AVATAR_COLORS = ['bg-brand-500', 'bg-sky-500', 'bg-violet-500', 'bg-keke-500']

/** Minutes until the group departs. Newly created groups default to +15 min from creation. */
function minutesToDeparture(group: Group): number {
  const created = new Date(group.createdAt).getTime()
  const departure = group.departsAt ? new Date(group.departsAt).getTime() : created + 15 * 60_000
  return Math.max(0, Math.round((departure - Date.now()) / 60_000))
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

function driverStatus(group: Group): { label: string; tone: 'amber' | 'violet' } {
  if (group.status === 'SEARCHING_DRIVER') {
    return { label: 'Finding Driver', tone: 'violet' }
  }
  return { label: 'Pending Driver', tone: 'amber' }
}

export function GroupsPage() {
  const { activeGroup, allPendingGroups } = useApp()
  const { joiningId, blockedGroupId, leaving, leaveBlocked, join, dismissBlock, viewActiveGroup, leaveAndJoin, dismissLeaveBlock } =
    useGroupJoin()

  // Refresh the live departure countdowns every 30s.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex min-h-full flex-col gap-5 pb-10 pt-10 lg:pt-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-slate-100">Groups</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">Join a group heading your way.</p>
      </header>

      {activeGroup && (
        <Card className="flex items-center gap-3 border-brand-200 dark:border-brand-500/30 bg-brand-50/70 dark:bg-brand-500/15 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Users aria-hidden className="size-5" />
            <span className="sr-only">Your group</span>
          </span>
          <div className="min-w-0 flex-1">
            <RouteIndicator pickup={activeGroup.pickup} destination={activeGroup.destination} />
            <p className="mt-0.5 text-xs text-ink-500 dark:text-slate-400">
              {groupSeatCount(activeGroup)}/{activeGroup.maxSize} passengers · You're in this group
            </p>
          </div>
          <Button size="sm" to={`/groups/${activeGroup.id}`}>
            Open
          </Button>
        </Card>
      )}

      <section aria-label="Waiting groups" className="mt-1">
        <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">Waiting groups</h2>

        {allPendingGroups.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {allPendingGroups.map((group) => (
              <WaitingGroupCard
                key={group.id}
                group={group}
                joining={joiningId === group.id}
                onJoin={() => join(group.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={Users}
              title="No groups are waiting right now"
              description="Everyone is moving fast! Start a group for your route and others will join."
              action={
                <Button to="/create-group">
                  Start New Group
                </Button>
              }
            />
          </div>
        )}
      </section>

      <Button to="/create-group" variant="outline" size="lg" fullWidth className="mt-2">
        <Plus aria-hidden className="size-5" />
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
        }}
        onViewGroup={viewActiveGroup}
        onLeaveGroup={leaveAndJoin}
      />
    </div>
  )
}

function WaitingGroupCard({
  group,
  joining,
  onJoin,
}: {
  group: Group
  joining: boolean
  onJoin: () => void
}) {
  const occupied = groupSeatCount(group)
  const mins = minutesToDeparture(group)
  const driver = driverStatus(group)
  const joinable = group.status === 'WAITING'
  const leavingLabel = mins < 1 ? 'Leaving soon' : `Leaving in: ${mins} min${mins === 1 ? '' : 's'}`

  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      {/* Route header */}
      <p className="truncate text-[15px] font-bold leading-snug text-ink-900 dark:text-slate-100">{group.pickup.name}</p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-[15px] font-bold leading-snug text-ink-900 dark:text-slate-100">
        <ArrowRight aria-hidden className="size-4 shrink-0 text-ink-400 dark:text-slate-500" />
        <span className="truncate">{group.destination.name}</span>
      </p>

      {/* Meta information row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-300">
          <Clock aria-hidden className="size-4" />
          {leavingLabel}
        </span>
        <Badge tone={driver.tone} dot>{driver.label}</Badge>
      </div>

      {/* Participant slot & action row */}
      <div className="mt-4 flex items-center justify-between border-t border-ink-100 dark:border-white/5 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <AvatarStack members={group.members} />
          <span className="text-sm font-semibold text-ink-800 dark:text-slate-200">
            {occupied}/{group.maxSize} joined
          </span>
        </div>

        {joinable ? (
          <button
            type="button"
            onClick={onJoin}
            disabled={joining}
            className="ml-3 shrink-0 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.97] disabled:bg-brand-300"
          >
            {joining ? 'Joining…' : 'Join Group'}
          </button>
        ) : (
          <span className="ml-3 shrink-0 rounded-full bg-ink-100 dark:bg-white/10 px-4 py-2.5 text-sm font-semibold text-ink-500 dark:text-slate-400">
            {group.status === 'SEARCHING_DRIVER' ? 'Finding driver…' : 'Group is full'}
          </span>
        )}
      </div>
    </Card>
  )
}

function AvatarStack({ members }: { members: GroupMember[] }) {
  const avatars = members.slice(0, 4)
  if (avatars.length === 0) return null

  return (
    <div className="flex shrink-0 -space-x-2" aria-hidden>
      {avatars.map((m, i) => (
        <span
          key={m.id}
          className={cn(
            'flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white',
            AVATAR_COLORS[i % AVATAR_COLORS.length],
          )}
        >
          {initialOf(m.name)}
        </span>
      ))}
    </div>
  )
}