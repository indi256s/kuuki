const PREFIX = 'kuuki:capture:'

export function readCapturePreference<T>(ownerId: string, key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(`${PREFIX}${ownerId}:${key}`) ?? 'null') ?? fallback } catch { return fallback }
}
export function writeCapturePreference(ownerId: string, key: string, value: unknown) {
  try { localStorage.setItem(`${PREFIX}${ownerId}:${key}`, JSON.stringify(value)) } catch { /* storage is optional */ }
}
export function clearCapturePreferences(ownerId?: string) {
  const prefix = ownerId === undefined ? PREFIX : `${PREFIX}${ownerId}:`
  // Also clear pre-migration tab state on the existing identity-reset path.
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = globalThis[name]
      for (const key of Object.keys(storage)) if (key.startsWith(prefix)) storage.removeItem(key)
    } catch { /* either store may be unavailable independently */ }
  }
}
