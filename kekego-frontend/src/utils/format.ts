import { CURRENCY } from '../config/pricing'

const NGN_SYMBOL = '₦'

/** Format a whole naira amount like ₦600 (no decimals shown). */
export function formatCurrency(amount: number, currency: string = CURRENCY): string {
  const symbol = currency.toUpperCase() === 'NGN' ? NGN_SYMBOL : `${currency} `
  return `${symbol}${amount.toLocaleString('en-NG')}`
}

/** "4 mins ago" style relative time for group creation timestamps. */
export function timeAgo(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000))

  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** Short time-of-day like "1:30 PM". */
export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Calendar date like "Today, 1:30 PM" or "Yesterday, 9:10 AM". */
export function formatDayTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((startOfToday - startOfDate) / 86_400_000)

  let day: string
  if (dayDiff === 0) day = 'Today'
  else if (dayDiff === 1) day = 'Yesterday'
  else if (dayDiff < 7) day = date.toLocaleDateString('en-US', { weekday: 'long' })
  else day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return `${day}, ${formatTime(date)}`
}