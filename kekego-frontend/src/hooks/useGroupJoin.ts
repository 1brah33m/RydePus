import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { isLeaveLockedError } from '../utils/rideStatus'

/**
 * Join-flow guard.
 *
 * Prevents a student from joining a group while they are already part of
 * another active one. When blocked it exposes the pending group so the UI can
 * offer to view the current group or leave it (and continue joining).
 * Joining always reserves exactly one seat; filling empty seats is a separate
 * explicit buyout step.
 */
export function useGroupJoin() {
  const navigate = useNavigate()
  const { activeGroup, joinGroup, leaveGroup } = useApp()

  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [blockedGroupId, setBlockedGroupId] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [leaveBlocked, setLeaveBlocked] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  const join = async (groupId: string) => {
    if (activeGroup && activeGroup.id !== groupId) {
      setBlockedGroupId(groupId)
      return
    }
    setJoiningId(groupId)
    setJoinError(null)
    try {
      const joined = await joinGroup(groupId)
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
    setLeaveError(null)
    setJoinError(null)
    try {
      const targetId = blockedGroupId
      await leaveGroup(activeGroup.id)
      setBlockedGroupId(null)
      const joined = await joinGroup(targetId)
      navigate(`/groups/${joined.id}`)
    } catch (error) {
      setLeaving(false)
      // Only a committed driver locks leaving; any other failure must show
      // its real message instead of the lock warning.
      if (isLeaveLockedError(error)) {
        setLeaveBlocked(true)
      } else {
        setLeaveError(error instanceof Error ? error.message : 'Could not leave your current group.')
      }
    }
  }

  const dismissLeaveBlock = () => setLeaveBlocked(false)

  const dismissLeaveError = () => setLeaveError(null)

  const dismissJoinError = () => setJoinError(null)

  return {
    joiningId,
    blockedGroupId,
    leaving,
    leaveBlocked,
    leaveError,
    joinError,
    activeGroup,
    join,
    dismissBlock,
    viewActiveGroup,
    leaveAndJoin,
    dismissLeaveBlock,
    dismissLeaveError,
    dismissJoinError,
  }
}
