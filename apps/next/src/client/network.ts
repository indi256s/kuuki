type Connection = EventTarget & { saveData?: boolean; effectiveType?: string; downlink?: number }
const connection = () => (navigator as Navigator & { connection?: Connection }).connection

export function isConstrainedConnection() {
  const network = connection()
  return !!(
    network?.saveData ||
    /(^|-)2g$|^3g$/.test(network?.effectiveType ?? '') ||
    (network?.downlink !== undefined && network.downlink > 0 && network.downlink <= 2)
  )
}

export function subscribeConnection(notify: () => void) {
  const network = connection()
  network?.addEventListener('change', notify)
  return () => network?.removeEventListener('change', notify)
}
