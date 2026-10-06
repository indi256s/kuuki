const PREFIX = 'kuuki-import-draft:v1:'

export function clearDrafts(ownerId?: string): void {
  try {
    const prefix = ownerId === undefined ? PREFIX : PREFIX + ownerId + ':'
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) localStorage.removeItem(key)
    }
  } catch { /* Storage unavailable. */ }
}
