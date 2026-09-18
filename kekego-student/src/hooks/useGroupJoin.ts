import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

/**
 * Join-flow guard.
 *
 * Prevents a student from joining a group while they are already part of
 * another active one. When blocked it exposes the pending group so the UI can
 * offer to view the current group or leave it (and continue joining).
 */
export function useGroupJoin() {
  const navigate = useNavigate()
  const { activeGroup, joinGroup, leaveGroup } = useApp()

  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [blockedGroupId, setBlockedGroupId] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [leaveBlocked, setLeaveBlocked] = useState(false)

  const join = async (groupId: string) => {
    if (activeGroup && activeGroup.id !== groupId) {
      setBlockedGroupId(groupId)
      return
    }
    setJoiningId(groupId)
    try {
      const joined = await joinGroup(groupId)
      navigate(`/groups/${joined.id}`)
    } catch {
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
    try {
      const targetId = blockedGroupId
      await leaveGroup(activeGroup.id)
      setBlockedGroupId(null)
      const joined = await joinGroup(targetId)
      navigate(`/groups/${joined.id}`)
    } catch {
      setLeaving(false)
      setLeaveBlocked(true)
    }
  }

  const dismissLeaveBlock = () => setLeaveBlocked(false)

  return {
    joiningId,
    blockedGroupId,
    leaving,
    leaveBlocked,
    activeGroup,
    join,
    dismissBlock,
    viewActiveGroup,
    leaveAndJoin,
    dismissLeaveBlock,
  }
}
