const PREFIX = 'kuuki:capture:'

export function readCapturePreference<T>(ownerId: string, key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(`${PREFIX}${ownerId}:${key}`) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}
export function writeCapturePreference(ownerId: string, key: string, value: unknown) {
  try {
    localStorage.setItem(`${PREFIX}${ownerId}:${key}`, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
export function removeCapturePreference(ownerId: string, key: string) {
  try {
    localStorage.removeItem(`${PREFIX}${ownerId}:${key}`)
  } catch {}
}
export function clearCapturePreferences(ownerId?: string) {
  const prefix = ownerId === undefined ? PREFIX : `${PREFIX}${ownerId}:`
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = globalThis[name]
      for (const key of Object.keys(storage)) if (key.startsWith(prefix)) storage.removeItem(key)
    } catch {}
  }
}
