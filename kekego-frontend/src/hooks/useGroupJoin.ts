import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { isLeaveLockedError } from '../utils/rideStatus'

export interface SeatPrompt {
  groupId: string
  /** Empty seats available — the upper bound of the choice. */
  max: number
  perSeat: number
  initial: number
}

function clampSeats(wanted: number, max: number): number {
  const safeMax = Math.max(1, max)
  if (!Number.isFinite(wanted)) return 1
  return Math.min(safeMax, Math.max(1, Math.trunc(wanted)))
}

/**
 * Join-flow guard.
 *
 * Prevents a student from joining a group while they are already part of
 * another active one. When blocked it exposes the pending group so the UI can
 * offer to view the current group or leave it (and continue joining).
 *
 * Seat counts are never inferred: `requestJoin` opens an explicit seat picker
 * (unless only 1 seat is open, where there is nothing to choose), and the
 * chosen count travels with the join — or with leave-and-join — so extra
 * seats are only ever covered by the joiner's own choice.
 */
export function useGroupJoin() {
  const navigate = useNavigate()
  const { activeGroup, joinGroup, leaveGroup } = useApp()

  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [blockedGroupId, setBlockedGroupId] = useState<string | null>(null)
  const [pendingSeats, setPendingSeats] = useState(1)
  const [pendingMax, setPendingMax] = useState(1)
  const [pendingPerSeat, setPendingPerSeat] = useState(0)
  const [seatPrompt, setSeatPrompt] = useState<SeatPrompt | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [leaveBlocked, setLeaveBlocked] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  const doJoin = async (groupId: string, seats: number) => {
    if (activeGroup && activeGroup.id !== groupId) {
      setPendingSeats(seats)
      setBlockedGroupId(groupId)
      return
    }
    setJoiningId(groupId)
    setJoinError(null)
    try {
      const joined = await joinGroup(groupId, seats)
      setSeatPrompt(null)
      navigate(`/groups/${joined.id}`)
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Could not join this group.')
      setJoiningId(null)
    }
  }

  /** Join with an already-chosen count (used by the seat picker confirm). */
  const join = async (groupId: string, seats = 1) => {
    await doJoin(groupId, seats)
  }

  /**
   * Start joining a group: opens the seat picker when there is a real choice,
   * joins with 1 seat immediately when only one seat is open.
   */
  const requestJoin = (groupId: string, max: number, perSeat: number, initial = 1) => {
    setJoinError(null)
    setLeaveError(null)
    const safeMax = Math.max(1, max)
    if (safeMax <= 1) {
      void doJoin(groupId, 1)
      return
    }
    if (activeGroup && activeGroup.id !== groupId) {
      setPendingSeats(clampSeats(initial, safeMax))
      setPendingMax(safeMax)
      setPendingPerSeat(perSeat)
      setBlockedGroupId(groupId)
      return
    }
    setPendingSeats(clampSeats(initial, safeMax))
    setSeatPrompt({ groupId, max: safeMax, perSeat, initial: clampSeats(initial, safeMax) })
  }

  /** Confirm the seat picker choice. */
  const confirmJoinSeats = async (seats: number) => {
    if (!seatPrompt) return
    const count = clampSeats(seats, seatPrompt.max)
    setPendingSeats(count)
    setSeatPrompt(null)
    await doJoin(seatPrompt.groupId, count)
  }

  const dismissSeatPrompt = () => setSeatPrompt(null)

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
      const seats = pendingSeats
      await leaveGroup(activeGroup.id)
      setBlockedGroupId(null)
      setLeaving(false)
      // After leaving, the joiner still picks their own seat count — never
      // inherit anything automatically.
      if (pendingMax > 1) {
        setSeatPrompt({
          groupId: targetId,
          max: pendingMax,
          perSeat: pendingPerSeat,
          initial: clampSeats(seats, pendingMax),
        })
        return
      }
      try {
        const joined = await joinGroup(targetId, seats)
        navigate(`/groups/${joined.id}`)
      } catch (joinError) {
        setJoinError(joinError instanceof Error ? joinError.message : 'Could not join this group.')
      }
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
    pendingSeats,
    seatPrompt,
    leaving,
    leaveBlocked,
    leaveError,
    joinError,
    activeGroup,
    join,
    requestJoin,
    confirmJoinSeats,
    dismissSeatPrompt,
    dismissBlock,
    viewActiveGroup,
    leaveAndJoin,
    dismissLeaveBlock,
    dismissLeaveError,
    dismissJoinError,
  }
}
