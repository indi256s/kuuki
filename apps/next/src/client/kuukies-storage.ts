const STORAGE_KEY = 'kuuki-kuukies'
/** Bump when the cookie list changes, so returning visitors see the notice again. */
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
  } catch {
    /* Blocked storage: show the notice again next visit. */
  }
}
