/** Browser storage can be denied even when reading the property; callers retain a tab-local baseline. */
export function notificationStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return window.localStorage
  } catch {
    return { getItem: () => null, setItem: () => {} }
  }
}
