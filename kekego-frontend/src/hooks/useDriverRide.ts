import { useDriverRideContext } from '../context/DriverRideContext'

/**
 * Driver dashboard state — now backed by `DriverRideProvider` so the
 * online/offline toggle persists across driver pages.
 * Kept as a thin wrapper so existing pages keep importing from here.
 */
export function useDriverRide() {
  return useDriverRideContext()
}
