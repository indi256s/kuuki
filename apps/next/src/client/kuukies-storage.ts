const STORAGE_KEY = 'kuuki-kuukies'
const VERSION = '1'

export function readSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === VERSION
  } catch {
    return false
  }
}

export function writeSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, VERSION)
  } catch {}
}
