import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

/**
 * Join-flow guard.
 *
 * Prevents a student from joining a group while they are already part of
 * another active one. When blocked it exposes the pending group so the UI can
 * offer to view the current group or leave it (and continue joining). The seat
 * count a student chooses travels with the join so a full group join is
 * rejected up front rather than overflowing capacity.
 */
export function useGroupJoin() {
  const navigate = useNavigate()
  const { activeGroup, joinGroup, leaveGroup } = useApp()

  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [blockedGroupId, setBlockedGroupId] = useState<string | null>(null)
  const [blockedSeats, setBlockedSeats] = useState(1)
  const [leaving, setLeaving] = useState(false)
  const [leaveBlocked, setLeaveBlocked] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const join = async (groupId: string, seats = 1) => {
    if (activeGroup && activeGroup.id !== groupId) {
      setBlockedSeats(seats)
      setBlockedGroupId(groupId)
      return
    }
    setJoiningId(groupId)
    setJoinError(null)
    try {
      const joined = await joinGroup(groupId, seats)
      navigate(`/groups/${joined.id}`)
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Could not join this group.')
      setJoiningId(null)
    }
  }

  const dismissBlock = () => setBlockedGroupId(null)

  const viewActiveGroup = () => {
    setBlockedGroupId(null)
    if (activeGroup) navigate(`/groups/${activeGroup.id}`)
  }

  const leaveAndJoin = async () => {
    if (!activeGroup || !blockedGroupId) return
    setLeaving(true)
    setLeaveBlocked(false)
    setJoinError(null)
    try {
      const targetId = blockedGroupId
      const seats = blockedSeats
      await leaveGroup(activeGroup.id)
      setBlockedGroupId(null)
      const joined = await joinGroup(targetId, seats)
      navigate(`/groups/${joined.id}`)
    } catch {
      setLeaving(false)
      setLeaveBlocked(true)
    }
  }

  const dismissLeaveBlock = () => setLeaveBlocked(false)

  const dismissJoinError = () => setJoinError(null)

  return {
    joiningId,
    blockedGroupId,
    leaving,
    leaveBlocked,
    joinError,
    activeGroup,
    join,
    dismissBlock,
    viewActiveGroup,
    leaveAndJoin,
    dismissLeaveBlock,
    dismissJoinError,
  }
}
