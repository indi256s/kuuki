const PREFIX = 'kuuki:capture:'

export function readCapturePreference<T>(ownerId: string, key: string, fallback: T): T {
  try { return JSON.parse(sessionStorage.getItem(`${PREFIX}${ownerId}:${key}`) ?? 'null') ?? fallback } catch { return fallback }
}
export function writeCapturePreference(ownerId: string, key: string, value: unknown) {
  try { sessionStorage.setItem(`${PREFIX}${ownerId}:${key}`, JSON.stringify(value)) } catch { /* storage is optional */ }
}
export function clearCapturePreferences() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key)
  } catch { /* storage is optional */ }
}
